import React from 'react';
import { Link } from 'react-router-dom';         
import Lottie from 'lottie-react';
import confettiAnimation from './assets/Files Transfer  Sharing.json'; // Change to your background Lottie
import './Background.css';

const MESSAGES = [
  "Transfer file with a flick of finger.",
  "Let our ROCKET do your work!"
];

class Background extends React.Component {
  state = {
    messageIndex: 0,
    fade: true,
  };

  componentDidMount() {
    this.cycle = setInterval(() => {
      this.setState({ fade: false });
      setTimeout(() => {
        this.setState(prev => ({
          messageIndex: (prev.messageIndex + 1) % MESSAGES.length,
          fade: true
        }));
      }, 500); // fade out duration
    }, 5000);
  }

  componentWillUnmount() {
    clearInterval(this.cycle);
  }

  render() {
    const { messageIndex, fade } = this.state;

    return (
      <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
        {/* Lottie background */}
        <Lottie
          animationData={confettiAnimation}
          loop={true}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 0,
            pointerEvents: "none",
          }}
        />

        {/* Centered animated text */}
        <div
          className={`d-flex justify-content-center align-items-center vh-100`}
          style={{
            position: "relative",
            zIndex: 1,
            width: "100vw",
            height: "100vh",
          }}
        >
          <h1
            style={{
              color: "#222",
              fontWeight: 700,
              fontSize: "2.5rem",
              background: "rgba(255,255,255,0.7)",
              borderRadius: "1rem",
              padding: "1.5rem 2.5rem",
              boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
              opacity: fade ? 1 : 0,
              transition: "opacity 0.5s",
              textAlign: "center",
              userSelect: "none"
            }}
          >
            {MESSAGES[messageIndex]}
          </h1>
        </div>
      </div>
    );
  }
}

export default Background;