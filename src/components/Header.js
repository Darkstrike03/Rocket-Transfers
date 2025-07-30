import React from "react";
import Lottie from "lottie-react";
import rocketAnimation from "./assets/Rocket in Space (Transparent Background).json";
import {link} from "react-router-dom";

class Header extends React.Component {
  handleHomeClick = () => {
    if (window.location.pathname === "/") {
      window.location.reload();
    } else {
      window.location.href = "/";
    }
  };

  render() {
    return (
      <nav className="navbar navbar-expand-lg bg-body-tertiary">
        <div className="container-fluid">
          <button
            className="navbar-brand btn btn-link p-0 border-0 d-flex align-items-center"
            style={{ background: "none", border: "none" }}
            onClick={this.handleHomeClick}
            aria-label="Home"
          >
            <Lottie
              animationData={rocketAnimation}
              loop={true}
              style={{ width: 40, height: 40, marginRight: 8 }}
            />
            <span style={{ fontWeight: "bold", fontSize: "1.25rem" }}>
              ROCKET <span style={{ color: "#007bff" }}>Transfers</span>
            </span>
          </button>
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarScroll"
            aria-controls="navbarScroll"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarScroll">
            <ul
              className="navbar-nav me-auto my-2 my-lg-0 navbar-nav-scroll"
              style={{ "--bs-scroll-height": "100px" }}
            >
              <li className="nav-item">
                <a className="nav-link active" aria-current="page" href="/">
                  HOME
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link" to="/Upload" href="/Upload">
                  UPLOAD
                </a>
              </li>
              <li className="nav-item">
                <a
                  className="nav-link" href="/Download" to="/Download">
                  DOWNLOAD
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="/Ghostlink" to="/Ghostlink">
                  GHOSTLINK
                </a>
              </li>
            </ul>

          </div>
        </div>
      </nav>
    );
  }
}

export default Header;
