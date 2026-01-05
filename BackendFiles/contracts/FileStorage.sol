// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract FileStorage {
    enum Visibility {
        PRIVATE,
        PUBLIC,
        SHARE_ON_REQUEST
    }

    struct File {
        address owner;
        string cid;
        Visibility visibility;
        address[] sharedWith;
    }

    struct AccessRequest {
        string cid;
        address requester;
        bool approved;
        bool decided;
    }

    struct TimedAccess{
        bool hasAccess;
        uint256 expiry;
    }

    // cid => file metadata
    mapping(string => File) public files;

    // owner => list of CIDs they uploaded
    mapping(address => string[]) private userFiles;

    // user => list of CIDs that user has been granted access to
    mapping(address => string[]) private sharedWithMe;

    // owner => list of access requests for their files
    mapping(address => AccessRequest[]) private accessRequests;

    //
    mapping(string=>mapping(address=>TimedAccess))public timedAccess;

    // all CIDs, used to build Public / Shared lists
    string[] private allCids;

    event FileRegistered(address indexed owner, string cid, Visibility visibility);
    event AccessGranted(string cid, address indexed user);
    event AccessRevoked(string cid, address indexed user);
    event AccessRequested(string cid, address indexed requester);
    event AccessRequestDecided(string cid, address indexed requester, bool approved);

    // -------- Core: Register File --------
    function registerFile(
        string memory cid,
        uint8 visibility,
        address[] memory sharedWith
    ) external {
        require(bytes(cid).length > 0, "CID cannot be empty");

        // if this CID is new, add it to index
        if (files[cid].owner == address(0)) {
            allCids.push(cid);
        }

        File storage f = files[cid];
        f.owner = msg.sender;
        f.cid = cid;
        f.visibility = Visibility(visibility);

        // reset previous shares
        delete f.sharedWith;

        // add new shares
        for (uint256 i = 0; i < sharedWith.length; i++) {
            address u = sharedWith[i];
            f.sharedWith.push(u);
            sharedWithMe[u].push(cid);
        }

        userFiles[msg.sender].push(cid);

        emit FileRegistered(msg.sender, cid, Visibility(visibility));
    }

    // -------- View: My Files --------
    function getUserFiles(address user) external view returns (string[] memory) {
        return userFiles[user];
    }

    // -------- View: Public / Shared (by visibility) --------
    function getFilesByVisibility(uint8 visibility)
        external
        view
        returns (string[] memory)
    {
        Visibility vis = Visibility(visibility);

        // count how many
        uint256 count = 0;
        for (uint256 i = 0; i < allCids.length; i++) {
            if (files[allCids[i]].visibility == vis) {
                count++;
            }
        }

        // build result
        string[] memory result = new string[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < allCids.length; i++) {
            if (files[allCids[i]].visibility == vis) {
                result[idx] = allCids[i];
                idx++;
            }
        }

        return result;
    }

    // -------- View: Shared With Me --------
    function getSharedWithMe(address user) external view returns (string[] memory) {
        return sharedWithMe[user];
    }

    // -------- Access Check --------
    function hasAccess(string memory cid, address user) public view returns (bool) {
        File storage f = files[cid];

        if (f.owner == user) return true;
        if (f.visibility == Visibility.PUBLIC) return true;

        // Time-based access check
        TimedAccess memory ta = timedAccess[cid][user];
        if (ta.hasAccess && block.timestamp <= ta.expiry) {
            return true;
        }

        // Normal shared access
        for (uint256 i = 0; i < f.sharedWith.length; i++) {
            if (f.sharedWith[i] == user) return true;
        }

        return false;
    }

    // -------- Owner: Grant / Revoke Access --------
    function grantAccess(string memory cid, address user) external {
        File storage f = files[cid];
        require(f.owner == msg.sender, "Only owner can grant");
        require(!hasAccess(cid, user), "Already has access");

        f.sharedWith.push(user);
        sharedWithMe[user].push(cid);

        emit AccessGranted(cid, user);
    }

    function grantTimedAccess(
        string memory cid,
        address user,
        uint256 durationInSeconds
    ) external {
        File storage f = files[cid];
        require(msg.sender == f.owner, "Only owner");

        uint256 expiryTime = block.timestamp + durationInSeconds;

        timedAccess[cid][user] = TimedAccess({
        hasAccess: true,
        expiry: expiryTime
        });

        emit AccessGranted(cid, user);
    }
    function revokeAccess(string memory cid, address user) external {
        File storage f = files[cid];
        require(f.owner == msg.sender, "Only owner can revoke");

        // remove from file.sharedWith
        uint256 len = f.sharedWith.length;
        for (uint256 i = 0; i < len; i++) {
            if (f.sharedWith[i] == user) {
                f.sharedWith[i] = f.sharedWith[len - 1];
                f.sharedWith.pop();
                emit AccessRevoked(cid, user);
                break;
            }
        }

        // remove from sharedWithMe[user]
        string[] storage arr = sharedWithMe[user];
        uint256 len2 = arr.length;
        for (uint256 j = 0; j < len2; j++) {
            if (keccak256(bytes(arr[j])) == keccak256(bytes(cid))) {
                arr[j] = arr[len2 - 1];
                arr.pop();
                break;
            }
        }
    }

    // -------- Access Requests --------
    function requestAccess(string memory cid) external {
        File storage f = files[cid];
        require(f.owner != address(0), "File not found");
        require(msg.sender != f.owner, "Owner already has access");
        require(!hasAccess(cid, msg.sender), "Already has access");

        accessRequests[f.owner].push(
            AccessRequest({
                cid: cid,
                requester: msg.sender,
                approved: false,
                decided: false
            })
        );

        emit AccessRequested(cid, msg.sender);
    }

    function getAccessRequests(address owner)
        external
        view
        returns (
            string[] memory cids,
            address[] memory requesters,
            bool[] memory approved,
            bool[] memory decided
        )
    {
        AccessRequest[] storage list = accessRequests[owner];
        uint256 len = list.length;

        cids = new string[](len);
        requesters = new address[](len);
        approved = new bool[](len);
        decided = new bool[](len);

        for (uint256 i = 0; i < len; i++) {
            AccessRequest storage r = list[i];
            cids[i] = r.cid;
            requesters[i] = r.requester;
            approved[i] = r.approved;
            decided[i] = r.decided;
        }
    }

    function decideAccessRequest(uint256 index, bool approve) external {
        AccessRequest[] storage list = accessRequests[msg.sender];
        require(index < list.length, "Invalid index");

        AccessRequest storage r = list[index];
        require(!r.decided, "Already decided");

        r.decided = true;
        r.approved = approve;

        if (approve) {
            File storage f = files[r.cid];
            if (f.owner == msg.sender) {
                // grant access
                f.sharedWith.push(r.requester);
                sharedWithMe[r.requester].push(r.cid);
                emit AccessGranted(r.cid, r.requester);
            }
        }

        emit AccessRequestDecided(r.cid, r.requester, approve);
    }

    // -------- File Details --------
    function getFileDetails(string memory cid)
        external
        view
        returns (
            address owner,
            Visibility visibility,
            address[] memory sharedWith
        )
    {
        File storage f = files[cid];
        return (f.owner, f.visibility, f.sharedWith);
    }
}