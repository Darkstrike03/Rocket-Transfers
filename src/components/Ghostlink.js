import React from "react";
import Lottie from "lottie-react";
import gradientLoading from "./assets/gradient loading.json";
import "./DarkMode.css";
import { supabase } from "../supabaseClient";

const TIME_OPTIONS = [
  { label: "5 min", value: "5m" },
  { label: "30 min", value: "30m" },
  { label: "1 hour", value: "1h" },
  { label: "2 hours", value: "2h" },
  { label: "5 hours", value: "5h" },
];

class Ghostlink extends React.Component {
  state = {
    showTransition: true,
    leaving: false,
    step: "info", // "info" | "create" | "enter"
    username: "",
    timeLimit: TIME_OPTIONS[2].value,
    code: "",
    joinModal: false,
    joinAdmin: "",
    joinRoomCode: "",
    error: null,
  };

  componentDidMount() {
    setTimeout(() => {
      document.body.classList.add("dark-mode");
      this.setState({ showTransition: false });
    }, 1200);
  }

  componentWillUnmount() {
    document.body.classList.remove("dark-mode");
  }

  handleLeave = () => {
    this.setState({ leaving: true, showTransition: true });
    setTimeout(() => {
      document.body.classList.remove("dark-mode");
      this.setState({ showTransition: false });
    }, 1200);
  };

  handleChange = (e) => {
    this.setState({ [e.target.name]: e.target.value, error: null });
  };

  handleCreate = () => {
    this.setState({ step: "create" });
  };

  handleEnter = () => {
    this.setState({ step: "enter" });
  };

  // Admin: Create room in Supabase and open Room
  handleStartRoom = async () => {
    const { username, timeLimit } = this.state;
    if (!username) {
        this.setState({ error: "Username is required." });
        return;
    }

    // Generate unique code
    const code = Math.random().toString(36).substr(2, 8).toUpperCase();

    // Insert room into Supabase
    const { error } = await supabase
      .from("rooms")
      .insert([
        {
          code,
          admin_username: username,
          time_limit: timeLimit,
        },
      ]);

    if (error) {
      this.setState({ error: "Failed to create room: " + error.message });
      return;
    }

    // Open Room as admin
    window.open(
      `/room?username=${encodeURIComponent(username)}&code=${encodeURIComponent(code)}&admin=1`,
      "_blank"
    );
  };

  // Attendee: Check code, show modal, then open Room
  handleJoinRoom = async () => {
    const { username, code } = this.state;
    if (!username) {
        this.setState({ error: "Username is required." });
        return;
    }
    if (!code) {
        this.setState({ error: "Room code is required." });
        return;
    }

    // Fetch room info from Supabase
    const { data, error } = await supabase
      .from("rooms")
      .select("admin_username")
      .eq("code", code)
      .single();

    if (error || !data) {
      this.setState({ error: "Invalid code or room not found." });
      return;
    }

    // Show modal with admin's username
    this.setState({
      joinModal: true,
      joinAdmin: data.admin_username,
      joinRoomCode: code,
    });
  };

  // Confirm join after modal
  confirmJoinRoom = () => {
    const { username, joinRoomCode } = this.state;
    window.open(
      `/room?username=${encodeURIComponent(username)}&code=${encodeURIComponent(joinRoomCode)}`,
      "_blank"
    );
    this.setState({ joinModal: false, joinAdmin: "", joinRoomCode: "" });
  };

  renderCard() {
    const { step, username, timeLimit, code, error } = this.state;

    if (step === "info") {
      return (
        <div
          className="card text-center p-4"
          style={{ minWidth: 320, maxWidth: 400 }}
        >
          <div className="card-body">
            <h2 className="mb-3">👻 Ghostlink</h2>
            <p>
              Ghostlink lets you create a one-time, self-destructing chat room.
              <br />
              Share a code, chat securely, and vanish without a trace!
            </p>
            <div className="d-flex justify-content-center gap-3 mt-4">
              <button
                className="btn btn-primary"
                onClick={this.handleCreate}
                data-testid="create-room-btn"
              >
                Create
              </button>
              <button
                className="btn btn-outline-light"
                onClick={this.handleEnter}
                data-testid="enter-room-btn"
              >
                Enter
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (step === "create") {
      return (
        <div
          className="card text-center p-4"
          style={{ minWidth: 320, maxWidth: 400 }}
        >
          <div className="card-body">
            <h4 className="mb-3">Create Room</h4>
            <input
              type="text"
              className="form-control mb-3"
              placeholder="Your username here..." /* Added placeholder */
              name="username"
              value={username}
              onChange={this.handleChange}
              autoFocus
              required /* Added required */
              data-testid="username-input"
            />
            <select
              className="form-select mb-3"
              name="timeLimit"
              value={timeLimit}
              onChange={this.handleChange}
              data-testid="time-limit-select"
            >
              {TIME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              className="btn btn-success w-100"
              onClick={this.handleStartRoom}
              disabled={!username}
              data-testid="start-room-btn"
            >
              Start Room
            </button>
            <button
              className="btn btn-link mt-2"
              onClick={() => this.setState({ step: "info" })}
              data-testid="back-to-info-btn"
            >
              Back
            </button>
            {error && <div className="alert alert-danger mt-2">{error}</div>}
          </div>
        </div>
      );
    }

    if (step === "enter") {
      return (
        <div
          className="card text-center p-4"
          style={{ minWidth: 320, maxWidth: 400 }}
        >
          <div className="card-body">
            <h4 className="mb-3">Enter Room</h4>
            <input
              type="text"
              className="form-control mb-3"
              placeholder="Your username here..." /* Added placeholder */
              name="username"
              value={username}
              onChange={this.handleChange}
              autoFocus
              required /* Added required */
              data-testid="username-input-enter"
            />
            <input
              type="text"
              className="form-control mb-3"
              placeholder="Enter room code here..." /* Added placeholder */
              name="code"
              value={code}
              onChange={this.handleChange}
              required /* Added required */
              data-testid="code-input"
            />
            <button
              className="btn btn-success w-100"
              onClick={this.handleJoinRoom}
              disabled={!username || !code}
              data-testid="join-room-btn"
            >
              Enter Room
            </button>
            <button
              className="btn btn-link mt-2"
              onClick={() => this.setState({ step: "info" })}
              data-testid="back-to-info-btn-enter"
            >
              Back
            </button>
            {error && <div className="alert alert-danger mt-2">{error}</div>}
          </div>
        </div>
      );
    }
  }

  renderJoinModal() {
    const { joinModal, joinAdmin } = this.state;
    if (!joinModal) return null;
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          zIndex: 10000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="card p-4 text-center" style={{ minWidth: 300 }}>
          <h5>
            Join{" "}
            <span style={{ color: "#8e44ad" }}>{joinAdmin}</span>'s room?
          </h5>
          <div className="d-flex justify-content-center gap-3 mt-4">
            <button className="btn btn-success" onClick={this.confirmJoinRoom}>
              Yes, Join
            </button>
            <button
              className="btn btn-outline-secondary"
              onClick={() =>
                this.setState({ joinModal: false, joinAdmin: "", joinRoomCode: "" })
              }
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  render() {
    const { showTransition, leaving } = this.state;

    return (
      <div className="d-flex justify-content-center align-items-center vh-100 position-relative">
        {/* Transition Animation */}
        {showTransition && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "#18191a",
              zIndex: 9999,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Lottie
              animationData={gradientLoading}
              style={{ width: 200, height: 200 }}
              loop={false}
            />
          </div>
        )}

        {/* Main Card Content */}
        {!showTransition && !leaving && this.renderCard()}

        {/* Join Modal */}
        {this.renderJoinModal()}
      </div>
    );
  }
}

export default Ghostlink;
