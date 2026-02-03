import React, { useState } from "react";
import { ethers } from "ethers";
import { create } from "ipfs-http-client";
import contractData from "./abis/FileStorage.json";
import "./styles.css";

/* ---------------- IPFS ---------------- */
const ipfs = create({ url: "http://localhost:5001/api/v0" });

/* ---------------- Visibility Enum ---------------- */
const VISIBILITY = {
  PRIVATE: 0,
  PUBLIC: 1,
  SHARE_ON_REQUEST: 2,
};

export default function App() {
  /* ---------------- Navigation ---------------- */
  const [loggedIn, setLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState("myFiles");

  /* ---------------- Auth ---------------- */
  const [walletInput, setWalletInput] = useState("");
  const [currentUser, setCurrentUser] = useState("");

  /* ---------------- Upload ---------------- */
  const [file, setFile] = useState(null);
  const [visibility, setVisibility] = useState(VISIBILITY.PRIVATE);
  const [shareAddressesText, setShareAddressesText] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [expiryTime, setExpiryTime] = useState("");
  const [loading, setLoading] = useState(false);

  /* ---------------- Data ---------------- */
  const [myFiles, setMyFiles] = useState([]);
  const [publicFiles, setPublicFiles] = useState([]);
  const [sharedFiles, setSharedFiles] = useState([]);
  const [sharedWithMe, setSharedWithMe] = useState([]);
  const [accessRequests, setAccessRequests] = useState([]);

  /* ---------------- Logs ---------------- */
  const [showLogs, setShowLogs] = useState(false);
  const [selectedCid, setSelectedCid] = useState("");
  const [logs, setLogs] = useState([]);

  /* ---------------- Contract Helper ---------------- */
  const getContract = () => {
    const address = import.meta.env.VITE_CONTRACT_ADDRESS;
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    return new ethers.Contract(address, contractData.abi, signer);
  };

  /* ---------------- Login ---------------- */
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!ethers.utils.isAddress(walletInput)) {
      alert("Enter valid wallet address");
      return;
    }
    await window.ethereum.request({ method: "eth_requestAccounts" });
    setCurrentUser(walletInput);
    setLoggedIn(true);
    loadAllData(walletInput);
  };

  const logout = () => {
    setLoggedIn(false);
    setCurrentUser("");
    setWalletInput("");
    setActiveTab("myFiles");
  };

  /* ---------------- Time Calculation ---------------- */
  const calculateSeconds = () => {
    if (!expiryDate || !expiryTime) return 0;
    const expiry = new Date(`${expiryDate}T${expiryTime}:00`);
    const now = new Date();
    const diff = Math.floor((expiry.getTime() - now.getTime()) / 1000);
    if (diff <= 0) {
      alert("Expiry must be in the future");
      return -1;
    }
    return diff;
  };

  /* ---------------- Load Data ---------------- */
  const loadAllData = async (addr) => {
    const c = getContract();
    setMyFiles(await c.getUserFiles(addr));
    setPublicFiles(await c.getFilesByVisibility(VISIBILITY.PUBLIC));
    setSharedFiles(await c.getFilesByVisibility(VISIBILITY.SHARE_ON_REQUEST));
    setSharedWithMe(await c.getSharedWithMe(addr));

    const req = await c.getAccessRequests(addr);
    const formatted = req[0].map((cid, i) => ({
      cid,
      requester: req[1][i],
      approved: req[2][i],
      decided: req[3][i],
      index: i,
    }));
    setAccessRequests(formatted);
  };

  /* ---------------- Upload ---------------- */
  const handleUpload = async () => {
    if (!file) return alert("Select a file");

    setLoading(true);
    try {
      const added = await ipfs.add(file);
      const cid = added.path;

      let addresses = [];
      if (shareAddressesText.trim()) {
        addresses = shareAddressesText
          .split(",")
          .map((a) => a.trim())
          .filter(ethers.utils.isAddress);
      }

      const contract = getContract();
      await (await contract.registerFile(cid, visibility, addresses)).wait();

      const seconds = calculateSeconds();
      if (seconds === -1) return;

      if (seconds > 0) {
        for (let addr of addresses) {
          await (await contract.grantTimedAccess(cid, addr, seconds)).wait();
        }
      }

      alert("File uploaded & registered");
      setFile(null);
      setShareAddressesText("");
      setExpiryDate("");
      setExpiryTime("");
      loadAllData(currentUser);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Requests ---------------- */
  const requestAccess = async (cid) => {
    const c = getContract();
    await (await c.requestAccess(cid)).wait();
    alert("Access request sent");
  };

  const decideRequest = async (index, approve) => {
    const c = getContract();
    await (await c.decideAccessRequest(index, approve)).wait();
    loadAllData(currentUser);
  };

  /* ---------------- Logs ---------------- */
  const openLogs = async (cid) => {
    const contract = getContract();
    const provider = contract.provider;

    const filters = [
      contract.filters.FileRegistered(null, cid),
      contract.filters.AccessRequested(cid),
      contract.filters.AccessGranted(cid),
      contract.filters.AccessRevoked(cid),
    ];

    let collected = [];

    for (let f of filters) {
      const events = await provider.getLogs({
        ...f,
        fromBlock: 0,
        toBlock: "latest",
      });

      for (let e of events) {
        const parsed = contract.interface.parseLog(e);
        const block = await provider.getBlock(e.blockNumber);
        collected.push({
          event: parsed.name,
          time: new Date(block.timestamp * 1000).toLocaleString(),
        });
      }
    }

    setSelectedCid(cid);
    setLogs(collected);
    setShowLogs(true);
  };

  /* ---------------- Login UI ---------------- */
  if (!loggedIn) {
    return (
      <div className="container">
        <form className="card" onSubmit={handleLogin}>
          <h2>Login</h2>
          <input
            placeholder="Wallet Address"
            value={walletInput}
            onChange={(e) => setWalletInput(e.target.value)}
          />
          <button className="btn">Login</button>
        </form>
      </div>
    );
  }

  /* ---------------- Main UI ---------------- */
  return (
    <div className="app">
      {/* Sidebar */}
      <div className="sidebar">
        <h2>Menu</h2>
        <div className="menu">
          <button className="active">{currentUser}</button>
          <button onClick={() => setActiveTab("myFiles")}>My Files</button>
          <button onClick={() => setActiveTab("upload")}>Upload</button>
          <button onClick={() => setActiveTab("public")}>Public Files</button>
          <button onClick={() => setActiveTab("shared")}>Shared Files</button>
          <button onClick={() => setActiveTab("sharedWithMe")}>Shared With Me</button>
          <button onClick={() => setActiveTab("requests")}>Access Requests</button>
        </div>

        <button className="logout" onClick={logout}>Logout</button>
      </div>

      {/* Main */}
      <div className="main">

        {/* My Files */}
        {activeTab === "myFiles" && (
          <div className="card">
            <h3>My Files</h3>
            <div className="files-grid">
              {myFiles.map((cid) => (
                <div key={cid} className="file">
                  <div onClick={() => window.open(`https://ipfs.io/ipfs/${cid}`)}>
                    {cid}
                  </div>
                  <button className="btn" onClick={() => openLogs(cid)}>Logs</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Public Files */}
        {activeTab === "public" && (
          <div className="card">
            <h3>Public Files</h3>
            <div className="files-grid">
              {publicFiles.map((cid) => (
                <div key={cid} className="file" onClick={() => window.open(`https://ipfs.io/ipfs/${cid}`)}>
                  {cid}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shared Files */}
        {activeTab === "shared" && (
          <div className="card">
            <h3>Shared (Request Access)</h3>
            <div className="files-grid">
              {sharedFiles.map((cid) => (
                <div key={cid} className="file">
                  {cid}
                  <button className="btn" onClick={() => requestAccess(cid)}>Request</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shared With Me */}
        {activeTab === "sharedWithMe" && (
          <div className="card">
            <h3>Shared With Me</h3>
            <div className="files-grid">
              {sharedWithMe.map((cid) => (
                <div key={cid} className="file" onClick={() => window.open(`https://ipfs.io/ipfs/${cid}`)}>
                  {cid}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload */}
        {activeTab === "upload" && (
          <div className="card">
            <h3>Upload & Register</h3>
            <input type="file" onChange={(e) => setFile(e.target.files[0])} />
            <select value={visibility} onChange={(e) => setVisibility(Number(e.target.value))}>
              <option value={0}>Private</option>
              <option value={1}>Public</option>
              <option value={2}>Share on Request</option>
            </select>
            <textarea
              placeholder="Share with (comma separated)"
              value={shareAddressesText}
              onChange={(e) => setShareAddressesText(e.target.value)}
            />
            <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            <input type="time" value={expiryTime} onChange={(e) => setExpiryTime(e.target.value)} />
            <button className="btn" onClick={handleUpload} disabled={loading}>
              {loading ? "Uploading..." : "Upload"}
            </button>
          </div>
        )}

        {/* Requests */}
        {activeTab === "requests" && (
          <div className="card">
            <h3>Access Requests</h3>
            {accessRequests.map((r) => (
              <div key={r.index} className="request-card">
                <span>{r.cid}</span>
                {!r.decided && (
                  <>
                    <button className="accept" onClick={() => decideRequest(r.index, true)}>Accept</button>
                    <button className="reject" onClick={() => decideRequest(r.index, false)}>Reject</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logs Modal */}
      {showLogs && (
        <div className="modal">
          <div className="card">
            <h3>Access Logs</h3>
            <p><b>CID:</b> {selectedCid}</p>
            {logs.length === 0 ? <p>No logs found</p> : logs.map((l, i) => (
              <div key={i}>{l.event} — {l.time}</div>
            ))}
            <button className="btn" onClick={() => setShowLogs(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
