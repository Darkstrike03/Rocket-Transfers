import React from "react";
import "./Room.css";
import { supabase } from "../supabaseClient";

// Helper: get query params
function getParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    code: params.get("code"),
    username: params.get("username") || "Anonymous",
    isAdmin: params.get("admin") === "1",
  };
}

class Room extends React.Component {
  state = {
    users: [],
    messages: [],
    chatInput: "",
    peerConnections: {},
    dataChannels: {},
    userId: null,
    username: "Anonymous",
    roomCode: null,
    isAdmin: false,
    adminUsername: "",
    timeLimit: "",
    createdAt: null,
    timeLeft: "",
    files: [],
    selectedFile: null,
    uploading: false,
    kicked: false,
    ended: false,
    incomingFiles: {},
  };

  timerInterval = null;

  constructor(props) {
    super(props);
    // Explicitly bind 'this' for all methods to ensure correct context
    this.createOffer = this.createOffer.bind(this);
    this.createPeerConnection = this.createPeerConnection.bind(this);
    this.sendSignal = this.sendSignal.bind(this);
    this.handleSignal = this.handleSignal.bind(this);
    this.setupDataChannel = this.setupDataChannel.bind(this);
    this.startTimer = this.startTimer.bind(this);
    this.handleChatInput = this.handleChatInput.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.handleFileChange = this.handleFileChange.bind(this);
    this.handleEndMeeting = this.handleEndMeeting.bind(this);
    this.handleKick = this.handleKick.bind(this);
  }

  async componentDidMount() {
    const { code, username, isAdmin } = getParams();
    const userId = Math.random().toString(36).substr(2, 9); // Generate a unique ID for this user

    // Fetch room info
    const { data: room, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code)
      .single();

    if (!room) {
      alert("Room not found or has ended.");
      this.setState({ ended: true });
      return;
    }

    this.setState({
      userId,
      username,
      roomCode: code,
      isAdmin,
      adminUsername: room.admin_username,
      timeLimit: room.time_limit,
      createdAt: room.created_at,
    });

    // Join Supabase Realtime channel for presence & signaling
    this.channel = supabase.channel(`room:${code}`, {
      config: { presence: { key: userId } }
    });

    // Presence: update user list
    this.channel.on("presence", { event: "sync" }, () => {
      const state = this.channel.presenceState();
      const users = Object.entries(state).map(([id, arr]) => ({
        userId: id,
        username: arr[0]?.username || "Unknown"
      }));
      this.setState({ users });
    });

    // Listen for admin actions (kick, end)
    this.channel.on("broadcast", { event: "admin" }, ({ payload }) => {
      if (payload.type === "kick" && payload.userId === userId) {
        this.setState({ kicked: true });
        setTimeout(() => window.close(), 1500);
      }
      if (payload.type === "end") {
        this.setState({ ended: true });
        setTimeout(() => window.close(), 1500);
      }
    });

    // Signaling: handle WebRTC offers/answers/candidates
    this.channel.on("broadcast", { event: "signal" }, ({ payload }) => {
      this.handleSignal(payload);
    });

    // Subscribe and track self
    await this.channel.subscribe();
    this.channel.track({ username });

    // When a new user joins, existing users initiate WebRTC offer
    // Or, more accurately, handle connections when presence changes
    this.channel.on("presence", { event: "join" }, ({ key }) => {
        // If a new user joins (key), and it's not me, and I don't already have a connection to them,
        // and my ID is lexicographically smaller (to avoid simultaneous offers from both ends),
        // then I initiate the offer.
        if (key !== userId && !this.state.peerConnections[key] && userId < key) {
            console.log(`[${userId}] New user ${key} joined. Initiating offer.`);
            this.createOffer(key);
        } else if (key !== userId && !this.state.peerConnections[key]) {
            // If my ID is larger, I'll wait for them to send an offer, or they'll be handled by handleSignal
            console.log(`[${userId}] New user ${key} joined. Waiting for offer or handling existing signal.`);
        }
    });


    // Start timer
    this.startTimer(room.created_at, room.time_limit);
  }

  componentWillUnmount() {
    if (this.channel) this.channel.unsubscribe();
    Object.values(this.state.peerConnections).forEach(pc => pc.close());
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  // --- Timer ---
  startTimer(createdAt, timeLimit) {
    const getExpiry = () => {
      const created = new Date(createdAt);
      if (timeLimit === "5m") created.setMinutes(created.getMinutes() + 5);
      else if (timeLimit === "30m") created.setMinutes(created.getMinutes() + 30);
      else if (timeLimit === "1h") created.setHours(created.getHours() + 1);
      else if (timeLimit === "2h") created.setHours(created.getHours() + 2);
      else if (timeLimit === "5h") created.setHours(created.getHours() + 5);
      return created;
    };
    this.timerInterval = setInterval(() => {
      const now = new Date();
      const expiry = getExpiry();
      const diff = Math.max(0, expiry - now);
      if (diff <= 0) {
        this.setState({ timeLeft: "00:00", ended: true });
        clearInterval(this.timerInterval);
        setTimeout(() => window.close(), 2000);
        return;
      }
      const min = String(Math.floor(diff / 60000)).padStart(2, "0");
      const sec = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
      this.setState({ timeLeft: `${min}:${sec}` });
    }, 1000);
  }

  // --- WebRTC Signaling ---
  sendSignal(to, data) {
    this.channel.send({
      type: "broadcast",
      event: "signal",
      payload: { ...data, from: this.state.userId, to }
    });
  }

  async handleSignal(data) {
    const { from, to, type, sdp, candidate } = data;
    if (to && to !== this.state.userId) return; // Not for me

    let pc = this.state.peerConnections[from];

    if (type === "offer") {
        if (!pc) {
            // If we don't have a PC, create one.
            pc = this.createPeerConnection(from);
        }

        // Add 'negotiationneeded' listener here for offers only if it's not already there.
        // This is a crucial part for handling subsequent renegotiations.
        if (!pc._negotiationListenerAdded) {
            pc.onnegotiationneeded = async () => {
                console.log(`[${this.state.userId}] Negotiation needed for ${from}. Current state: ${pc.signalingState}`);
                if (pc.signalingState === "stable") { // Only create offer if stable
                    try {
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        this.sendSignal(from, { type: "offer", sdp: offer });
                    } catch (e) {
                        console.error(`[${this.state.userId}] Error creating/setting offer on negotiationneeded for ${from}:`, e);
                    }
                } else {
                    console.warn(`[${this.state.userId}] Skipping negotiation for ${from} in signalingState: ${pc.signalingState}`);
                }
            };
            pc._negotiationListenerAdded = true; // Mark as added
        }


        // Handle 'glare' (simultaneous offers)
        // If I have a local offer and receive an offer, apply tie-breaker
        if (pc.signalingState === "have-local-offer") {
            // Compare user IDs to decide who wins the 'glare'
            if (this.state.userId > from) { // My ID is higher, their offer wins
                console.log(`[${this.state.userId}] Glare detected: My ID (${this.state.userId}) > Their ID (${from}). Accepting their offer.`);
                // Rollback my local offer and accept theirs
                await pc.setLocalDescription(new RTCSessionDescription({ type: 'rollback' }));
                await pc.setRemoteDescription(new window.RTCSessionDescription(sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                this.sendSignal(from, { type: "answer", sdp: answer });
            } else { // My ID is lower, my offer wins. Ignore their offer for now.
                console.log(`[${this.state.userId}] Glare detected: My ID (${this.state.userId}) < Their ID (${from}). Ignoring their offer.`);
                // Do nothing, let my offer proceed
            }
        } else if (pc.signalingState === "stable" || pc.signalingState === "have-remote-offer") {
             // Normal offer reception or re-offer
            console.log(`[${this.state.userId}] Receiving offer from ${from}. State: ${pc.signalingState}`);
            await pc.setRemoteDescription(new window.RTCSessionDescription(sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            this.sendSignal(from, { type: "answer", sdp: answer });
        } else {
            console.warn(`[${this.state.userId}] Received offer from ${from} in unexpected state: ${pc.signalingState}.`);
        }

    } else if (type === "answer") {
        if (!pc) {
            console.warn(`[${this.state.userId}] Received answer from ${from} but no PeerConnection exists. Possibly stale.`);
            return; // No PC to apply answer to
        }
        console.log(`[${this.state.userId}] Receiving answer from ${from}. Current state: ${pc.signalingState}`);

        // Only set remote description if we're waiting for an answer
        if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new window.RTCSessionDescription(sdp));
        } else {
            console.warn(`[${this.state.userId}] Received answer from ${from} in unexpected state: ${pc.signalingState}. Expected 'have-local-offer'.`);
        }
    } else if (type === "candidate") {
        if (pc && candidate) {
            try {
                await pc.addIceCandidate(new window.RTCIceCandidate(candidate));
            } catch (e) {
                // Ignore errors from adding candidates that have already been added.
                // This can happen with duplicate candidates or if a candidate arrives
                // before setRemoteDescription has completed.
                if (!e.message.includes("candidate has already been added")) {
                    console.error(`[${this.state.userId}] Error adding ICE candidate from ${from}:`, e);
                }
            }
        } else if (!pc) {
             console.warn(`[${this.state.userId}] Received candidate from ${from} but no PeerConnection exists.`);
        }
    }
  }

  createPeerConnection(peerId) {
    let pc = this.state.peerConnections[peerId];
    if (pc) return pc; // Return existing PC if it's already there

    console.log(`[${this.state.userId}] Creating new PeerConnection for ${peerId}`);
    pc = new window.RTCPeerConnection({
        iceServers: [ // Add STUN servers for NAT traversal
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            // You might add TURN servers here for more complex network scenarios
        ]
    });

    // Set up DataChannel
    let dc;
    // The user with the lexicographically smaller userId creates the DataChannel
    // This ensures only one data channel per peer connection
    if (this.state.userId < peerId) {
      dc = pc.createDataChannel("chat");
      this.setupDataChannel(peerId, dc);
    } else {
      pc.ondatachannel = (event) => this.setupDataChannel(peerId, event.channel);
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(peerId, { type: "candidate", candidate: event.candidate });
      }
    };

    // Store the new PC
    this.setState(prev => ({
      peerConnections: { ...prev.peerConnections, [peerId]: pc }
    }));

    return pc;
  }

  async createOffer(peerId) {
    let pc = this.state.peerConnections[peerId];
    if (!pc) {
        pc = this.createPeerConnection(peerId);
    }

    // Only create a new offer if the current signaling state allows it.
    // Avoid creating offers if we're already in the middle of a negotiation or have a local offer pending.
    if (pc.signalingState === "stable" || pc.signalingState === "have-remote-pranswer" || pc.signalingState === "closed") {
        try {
            console.log(`[${this.state.userId}] Creating offer for ${peerId}`);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            this.sendSignal(peerId, { type: "offer", sdp: offer });
        } catch (e) {
            console.error(`[${this.state.userId}] Error creating/setting offer for ${peerId}:`, e);
        }
    } else {
        console.warn(`[${this.state.userId}] Skipping offer creation for ${peerId} in signalingState: ${pc.signalingState}`);
    }
  }

  setupDataChannel(peerId, dc) {
    dc.onopen = () => {
      console.log(`DataChannel with ${peerId} is open`);
      this.setState(prev => ({
        dataChannels: { ...prev.dataChannels, [peerId]: dc }
      }));
    };
    dc.onmessage = (event) => {
      try {
        const receivedData = JSON.parse(event.data);
        if (receivedData.type === "chat") {
          this.setState(prev => ({
            messages: [...prev.messages, receivedData]
          }));
        } else if (receivedData.type === "file-meta") {
          console.log("Received file metadata:", receivedData);
          this.setState(prev => ({
            incomingFiles: {
              ...prev.incomingFiles,
              [receivedData.fileId]: {
                meta: receivedData,
                chunks: [],
                receivedSize: 0
              }
            }
          }));
        }
      } catch (e) {
        // If it's not JSON, assume it's a file data chunk (ArrayBuffer)
        const arrayBuffer = event.data;
        let targetFileId = null;
        for (const fileId in this.state.incomingFiles) {
          const incomingFile = this.state.incomingFiles[fileId];
          // Check if this file is still incomplete
          if (incomingFile && incomingFile.receivedSize < incomingFile.meta.size) {
            targetFileId = fileId;
            break; // Found an incomplete file to append to
          }
        }

        if (targetFileId) {
          this.setState(prev => {
            const incomingFile = prev.incomingFiles[targetFileId];
            // Make a copy to ensure immutability with push
            const newChunks = [...incomingFile.chunks, arrayBuffer];
            const newReceivedSize = incomingFile.receivedSize + arrayBuffer.byteLength;

            if (newReceivedSize >= incomingFile.meta.size) {
              console.log("All chunks received for file:", incomingFile.meta.fileName);
              const completeBlob = new Blob(newChunks, { type: incomingFile.meta.fileType });
              return {
                files: [...prev.files, {
                  name: incomingFile.meta.fileName,
                  type: incomingFile.meta.fileType,
                  data: completeBlob,
                  fileId: incomingFile.meta.fileId
                }],
                incomingFiles: { ...prev.incomingFiles, [targetFileId]: undefined }, // Clear
                selectedFile: prev.files.length > 0 ? prev.files.length : 0 // Select the new file
              };
            }
            // Update the incomingFile with new chunks and size
            return {
                incomingFiles: {
                    ...prev.incomingFiles,
                    [targetFileId]: {
                        ...incomingFile,
                        chunks: newChunks,
                        receivedSize: newReceivedSize
                    }
                }
            };
          });
        } else {
          console.warn("Received non-JSON, non-file-chunk data without matching file metadata:", event.data);
          // Fallback: If it's not JSON and we can't associate it with a file, treat as a generic message
          const msgObj = { user: peerId, text: event.data.toString(), username: undefined };
          this.setState(prev => ({
            messages: [...prev.messages, msgObj]
          }));
        }
      }
    };
    dc.onclose = () => {
      console.log(`DataChannel with ${peerId} closed`);
      // Optionally remove from dataChannels state
      this.setState(prev => {
          const newDcs = { ...prev.dataChannels };
          delete newDcs[peerId];
          return { dataChannels: newDcs };
      });
    };
    dc.onerror = (error) => {
      console.error(`DataChannel error with ${peerId}:`, error);
    };
  }

  // --- Messaging ---
  handleChatInput(e) {
    this.setState({ chatInput: e.target.value });
  }

  sendMessage() {
    const { chatInput, dataChannels, userId, username } = this.state;
    if (!chatInput.trim()) return;

    const msgObj = { type: "chat", user: userId, username, text: chatInput };
    let sentToAny = false;

    Object.values(dataChannels).forEach(dc => {
      if (dc.readyState === "open") {
        dc.send(JSON.stringify(msgObj));
        sentToAny = true;
      } else {
        console.warn(`DataChannel with peer ${dc.label} is not open (readyState: ${dc.readyState}). Message not sent.`);
      }
    });

    this.setState(prev => ({
      messages: [...prev.messages, msgObj],
      chatInput: ""
    }));
  }

  // --- File Transfer ---
  handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    this.setState({ uploading: true });

    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result;
      const chunkSize = 16 * 1024; // 16KB chunks
      const fileId = `${this.state.userId}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`; // Unique ID for this file

      let sentToAnyPeer = false;

      Object.values(this.state.dataChannels).forEach(dc => {
        if (dc.readyState === "open") {
          // Send file metadata first
          dc.send(JSON.stringify({
            type: "file-meta",
            fileName: file.name,
            fileType: file.type,
            size: file.size,
            fileId: fileId,
            fromUser: this.state.userId,
            fromUsername: this.state.username
          }));

          // Send chunks
          for (let i = 0; i < arrayBuffer.byteLength; i += chunkSize) {
            const chunk = arrayBuffer.slice(i, i + chunkSize);
            dc.send(chunk);
          }
          sentToAnyPeer = true;
        } else {
          console.warn(`DataChannel with peer ${dc.label} is not open (readyState: ${dc.readyState}). File not sent.`);
        }
      });

      // Add file to local state for immediate preview on sender's side
      // Create a Blob from the ArrayBuffer for local preview
      const fileBlob = new Blob([arrayBuffer], { type: file.type });
      this.setState(prev => ({
        files: [...prev.files, { name: file.name, type: file.type, data: fileBlob, fileId: fileId }],
        uploading: false,
        selectedFile: prev.files.length // Automatically select the newly uploaded file
      }));

      if (!sentToAnyPeer) {
        alert("No active connections to send the file to. File added to your local view only.");
      }
    };
    reader.onerror = (error) => {
      console.error("FileReader error:", error);
      this.setState({ uploading: false });
      alert("Error reading file.");
    };
    reader.readAsArrayBuffer(file);
  }

  // --- Admin Actions ---
  async handleEndMeeting() {
    if (this.state.isAdmin) {
      // Delete room from Supabase
      await supabase.from("rooms").delete().eq("code", this.state.roomCode);
      // Broadcast end signal
      this.channel.send({
        type: "broadcast",
        event: "admin",
        payload: { type: "end" }
      });
      this.setState({ ended: true });
      setTimeout(() => window.close(), 1500);
    } else {
      // For non-admins, this is a "Leave Meeting" button
      this.channel.unsubscribe();
      Object.values(this.state.peerConnections).forEach(pc => pc.close());
      this.setState({ ended: true });
      setTimeout(() => window.close(), 1500);
    }
  }

  handleKick(userIdToKick) {
    if (!this.state.isAdmin) return;
    if (userIdToKick === this.state.userId) {
      alert("You cannot kick yourself.");
      return;
    }
    this.channel.send({
      type: "broadcast",
      event: "admin",
      payload: { type: "kick", userId: userIdToKick }
    });
  }

  // --- UI ---
  render() {
    const {
      users, messages, chatInput, isAdmin, adminUsername, roomCode, timeLeft,
      files, selectedFile, uploading, kicked, ended, userId
    } = this.state;

    if (kicked) return <div className="room-ended">You were kicked from the room.</div>;
    if (ended) return <div className="room-ended">Meeting ended.</div>;

    const currentSelectedFile = selectedFile !== null ? files[selectedFile] : null;

    return (
      <div className="room-container">
        {/* Left: Chat */}
        <div className="room-chat">
          <div className="chat-header">Chat</div>
          <div className="chat-messages">
            {messages.map((msg, idx) => {
              const displayName = msg.username || "Unknown User";
              const isMe = msg.user === userId;
              return (
                <div key={idx} className={`chat-message${isMe ? " me" : ""}`}>
                  <div className="chat-bubble">
                    <div className="chat-username">{displayName}</div>
                    <div>{msg.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="chat-input">
            <input
              type="text"
              value={chatInput}
              onChange={this.handleChatInput}
              placeholder="Type a message..."
              onKeyDown={e => e.key === "Enter" && this.sendMessage()}
            />
            <button className="btn btn-primary" onClick={this.sendMessage}>Send</button>
          </div>
        </div>

        {/* Center: File Preview */}
        <div className="room-preview">
          <div className="preview-header d-flex align-items-center justify-content-between">
            <div>
              <span className="meeting-code">Code: {roomCode}</span>
              <span className="meeting-timer ms-3">Time left: {timeLeft}</span>
              <span className="meeting-admin ms-3">Host: {adminUsername}</span>
            </div>
            {isAdmin ? (
              <button
                className="btn btn-danger btn-sm ms-3"
                onClick={this.handleEndMeeting}
              >
                End Meeting
              </button>
            ) : (
              <button
                className="btn btn-outline-danger btn-sm ms-3"
                onClick={this.handleEndMeeting}
              >
                Leave Meeting
              </button>
            )}
          </div>
          <div className="preview-files">
            <div className="file-tabs">
              {files.map((file, idx) => (
                <button
                  key={file.fileId || idx}
                  className={`btn btn-outline-secondary btn-sm ${selectedFile === idx ? "active" : ""}`}
                  onClick={() => this.setState({ selectedFile: idx })}
                >
                  {file.name}
                </button>
              ))}
            </div>
            <div className="file-viewer">
              {currentSelectedFile ? (
                <div>
                  <div><b>{currentSelectedFile.name}</b></div>
                  {currentSelectedFile.type.startsWith("image/") ? (
                    <img
                      src={URL.createObjectURL(currentSelectedFile.data)}
                      alt={currentSelectedFile.name}
                      style={{ maxWidth: "100%", maxHeight: 200 }}
                    />
                  ) : (
                    <a
                      href={URL.createObjectURL(currentSelectedFile.data)}
                      download={currentSelectedFile.name}
                      className="btn btn-sm btn-success mt-2"
                    >
                      Download
                    </a>
                  )}
                </div>
              ) : (
                <div className="file-placeholder">File preview here</div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Upload & Users */}
        <div className="room-side">
          <div className="side-upload">
            <div className="upload-header">Upload Files</div>
            <div className="upload-dropzone">
              <input
                type="file"
                multiple={false}
                style={{ display: "none" }}
                id="fileInput"
                onChange={this.handleFileChange}
                disabled={uploading}
              />
              <label htmlFor="fileInput" className="upload-label" style={{ cursor: uploading ? "not-allowed" : "pointer" }}>
                {uploading ? "Uploading..." : "Drag & drop or browse"}
              </label>
            </div>
          </div>
          <div className="side-users">
            <div className="users-header">Users</div>
            <ul className="users-list">
              {users.map((user) => (
                <li key={user.userId} className="d-flex justify-content-between align-items-center">
                  {user.username} {user.userId === userId && "(You)"}
                  {isAdmin && user.userId !== userId && (
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => this.handleKick(user.userId)}
                    >
                      Kick
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }
}

export default Room;
