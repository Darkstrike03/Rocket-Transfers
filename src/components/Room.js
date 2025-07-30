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
  };

  timerInterval = null;

  async componentDidMount() {
    const { code, username, isAdmin } = getParams();
    const userId = Math.random().toString(36).substr(2, 9);

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
    this.channel.on("presence", { event: "join" }, ({ key }) => {
      if (key !== userId) this.createOffer(key);
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
  startTimer = (createdAt, timeLimit) => {
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
  };

  // --- WebRTC Signaling ---
  sendSignal = (to, data) => {
    this.channel.send({
      type: "broadcast",
      event: "signal",
      payload: { ...data, from: this.state.userId, to }
    });
  };

  handleSignal = async (data) => {
    const { from, to, type, sdp, candidate, fileMeta, fileChunk } = data;
    if (to && to !== this.state.userId) return; // Not for me

    if (type === "offer") {
      const pc = this.createPeerConnection(from);
      await pc.setRemoteDescription(new window.RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.sendSignal(from, { type: "answer", sdp: answer });
    } else if (type === "answer") {
      const pc = this.state.peerConnections[from];
      if (pc) await pc.setRemoteDescription(new window.RTCSessionDescription(sdp));
    } else if (type === "candidate") {
      const pc = this.state.peerConnections[from];
      if (pc && candidate) await pc.addIceCandidate(new window.RTCIceCandidate(candidate));
    }
    // File transfer signaling (optional, for chunked files)
    if (type === "file-meta" && fileMeta) {
      this.receiveFileMeta(from, fileMeta);
    }
    if (type === "file-chunk" && fileChunk) {
      this.receiveFileChunk(from, fileChunk);
    }
  };

  createPeerConnection = (peerId) => {
    let pc = this.state.peerConnections[peerId];
    if (pc) return pc;

    pc = new window.RTCPeerConnection();
    let dc;
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
    this.setState(prev => ({
      peerConnections: { ...prev.peerConnections, [peerId]: pc }
    }));
    return pc;
  };

  createOffer = async (peerId) => {
    const pc = this.createPeerConnection(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.sendSignal(peerId, { type: "offer", sdp: offer });
  };

  setupDataChannel = (peerId, dc) => {
    dc.onopen = () => {
      this.setState(prev => ({
        dataChannels: { ...prev.dataChannels, [peerId]: dc }
      }));
    };
    dc.onmessage = (event) => {
      let msgObj;
      try {
        msgObj = JSON.parse(event.data);
      } catch {
        msgObj = { user: peerId, text: event.data, username: undefined };
      }
      this.setState(prev => ({
        messages: [...prev.messages, msgObj]
      }));
    };
  };

  // --- Messaging ---
  handleChatInput = (e) => {
    this.setState({ chatInput: e.target.value });
  };

  sendMessage = () => {
    const { chatInput, dataChannels, userId, username } = this.state;
    if (!chatInput) return;
    const msgObj = { user: userId, username, text: chatInput };
    Object.values(dataChannels).forEach(dc => {
      if (dc.readyState === "open") dc.send(JSON.stringify(msgObj));
    });
    this.setState(prev => ({
      messages: [...prev.messages, msgObj],
      chatInput: ""
    }));
  };

  // --- File Transfer (basic, small files only) ---
  handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    this.setState({ uploading: true });
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result;
      Object.values(this.state.dataChannels).forEach(dc => {
        if (dc.readyState === "open") {
          dc.send(JSON.stringify({ fileName: file.name, fileType: file.type, size: file.size }));
          dc.send(arrayBuffer);
        }
      });
      this.setState(prev => ({
        files: [...prev.files, { name: file.name, type: file.type, data: arrayBuffer }],
        uploading: false,
      }));
    };
    reader.readAsArrayBuffer(file);
  };

  // Receive file meta and chunk (for advanced chunked transfer)
  receiveFileMeta = (from, meta) => {
    // Implement chunked file receive if needed
  };
  receiveFileChunk = (from, chunk) => {
    // Implement chunked file receive if needed
  };

  // --- Admin Actions ---
  handleEndMeeting = async () => {
    if (this.state.isAdmin) {
      await supabase.from("rooms").delete().eq("code", this.state.roomCode);
      this.channel.send({
        type: "broadcast",
        event: "admin",
        payload: { type: "end" }
      });
      this.setState({ ended: true });
      setTimeout(() => window.close(), 1500);
    } else {
      this.setState({ ended: true });
      setTimeout(() => window.close(), 1500);
    }
  };

  handleKick = (userId) => {
    if (!this.state.isAdmin) return;
    this.channel.send({
      type: "broadcast",
      event: "admin",
      payload: { type: "kick", userId }
    });
  };

  // --- UI ---
  render() {
    const {
      users, messages, chatInput, isAdmin, adminUsername, roomCode, timeLeft,
      files, selectedFile, uploading, kicked, ended, userId
    } = this.state;

    if (kicked) return <div className="room-ended">You were kicked from the room.</div>;
    if (ended) return <div className="room-ended">Meeting ended.</div>;

    return (
      <div className="room-container">
        {/* Left: Chat */}
        <div className="room-chat">
          <div className="chat-header">Chat</div>
          <div className="chat-messages">
            {messages.map((msg, idx) => {
              const displayName = msg.username || msg.user || "Unknown";
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
                  key={idx}
                  className={`btn btn-outline-secondary btn-sm ${selectedFile === idx ? "active" : ""}`}
                  onClick={() => this.setState({ selectedFile: idx })}
                >
                  {file.name}
                </button>
              ))}
            </div>
            <div className="file-viewer">
              {selectedFile !== null && files[selectedFile] ? (
                <div>
                  <div><b>{files[selectedFile].name}</b></div>
                  {files[selectedFile].type.startsWith("image/") ? (
                    <img
                      src={URL.createObjectURL(new Blob([files[selectedFile].data], { type: files[selectedFile].type }))}
                      alt={files[selectedFile].name}
                      style={{ maxWidth: "100%", maxHeight: 200 }}
                    />
                  ) : (
                    <a
                      href={URL.createObjectURL(new Blob([files[selectedFile].data], { type: files[selectedFile].type }))}
                      download={files[selectedFile].name}
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
                  {user.username}
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