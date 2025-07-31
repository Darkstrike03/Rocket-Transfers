// Footer.js
import React from 'react';
import './Footer.css'; // Import the CSS for styling

// Import the content components for the modals
import PrivacyPolicy from './InfoPages/PrivacyPolicy'; // Adjust path if necessary
import TermsOfService from './InfoPages/TermsOfService'; // Adjust path if necessary
import AboutUs from './InfoPages/AboutUs';             // Adjust path if necessary
import ContactUs from './InfoPages/ContactUs';           // Adjust path if necessary

// Map content keys to their respective components
const MODAL_COMPONENTS = {
  PRIVACY_POLICY: { Component: PrivacyPolicy },
  TERMS_OF_SERVICE: {Component: TermsOfService },
  ABOUT_US: {Component: AboutUs },
  CONTACT_US: {Component: ContactUs },
};

class Footer extends React.Component {
  state = {
    activeModalContent: null, // Stores the content object for the currently active modal
  };

  // Method to open specific info modals
  openInfoModal = (contentTypeKey) => {
    this.setState({ activeModalContent: MODAL_COMPONENTS[contentTypeKey] });
  };

  // Method to close specific info modals
  closeInfoModal = () => {
    this.setState({ activeModalContent: null });
  };

  // Handler for link clicks in the footer
  handleLinkClick = (contentKey) => (e) => {
    e.preventDefault(); // Prevent default link behavior (page reload/scroll)
    this.openInfoModal(contentKey);
  };

  // New render method for the info/policy modals, now part of Footer
  renderInfoModal() {
    const { activeModalContent } = this.state;
    if (!activeModalContent) return null;

    const ModalComponent = activeModalContent.Component;

    return (
      <div
        className="modal-backdrop"
        onClick={this.closeInfoModal} // Close modal when clicking outside
      >
        <div
          className="card p-4 text-start footer-modal-content" // Added footer-modal-content class for specific styles
          onClick={e => e.stopPropagation()} // Prevent closing when clicking inside modal
        >
          <button
            className="btn-close"
            aria-label="Close"
            onClick={this.closeInfoModal}
          ></button>
          <h4 className="mb-3">{activeModalContent.title}</h4>
          <div className="modal-body-content">
            <ModalComponent /> {/* Render the specific content component here */}
          </div>
          <div className="d-flex justify-content-end mt-4">
            <button className="btn btn-secondary" onClick={this.closeInfoModal}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  render() {
    const currentYear = new Date().getFullYear();
    const githubCreatorLink = "https://github.com/Darkstrike03/Rocket-Transfers"; // << IMPORTANT: Replace with your actual GitHub username!

    // SVG for the GitHub icon
    const githubSvg = (
      <svg
        aria-hidden="true" height="24" viewBox="0 0 24 24" version="1.1" width="24" data-view-component="true" className="octicon octicon-mark-github">
        <path d="M12 1C5.923 1 1 5.923 1 12c0 4.867 3.149 8.979 7.521 10.436.55.096.756-.233.756-.522 0-.262-.013-1.128-.013-2.049-2.764.509-3.479-.674-3.699-1.292-.124-.317-.66-1.293-1.127-1.554-.385-.207-.936-.715-.014-.729.866-.014 1.485.797 1.691 1.128.99 1.663 2.571 1.196 3.204.907.096-.715.385-1.196.701-1.471-2.448-.275-5.005-1.224-5.005-5.432 0-1.196.426-2.186 1.128-2.956-.111-.275-.496-1.402.11-2.915 0 0 .921-.288 3.024 1.128a10.193 10.193 0 0 1 2.75-.371c.936 0 1.871.123 2.75.371 2.104-1.43 3.025-1.128 3.025-1.128.605 1.513.221 2.64.111 2.915.701.77 1.127 1.747 1.127 2.956 0 4.222-2.571 5.157-5.019 5.432.399.344.743 1.004.743 2.035 0 1.471-.014 2.654-.014 3.025 0 .289.206.632.756.522C19.851 20.979 23 16.854 23 12c0-6.077-4.922-11-11-11Z"></path>
      </svg>
    );

    return (
      <footer className="footer-container">
        <div className="footer-content">
          <div className="footer-links">
            {/* Call handleLinkClick directly from within Footer */}
            <a href="#" onClick={this.handleLinkClick("PRIVACY_POLICY")} className="footer-link">Privacy Policy</a>
            <a href="#" onClick={this.handleLinkClick("TERMS_OF_SERVICE")} className="footer-link">Terms of Service</a>
            <a href="#" onClick={this.handleLinkClick("ABOUT_US")} className="footer-link">About Us</a>
            <a href="#" onClick={this.handleLinkClick("CONTACT_US")} className="footer-link">Contact Us</a>
          </div>
          <div className="footer-creator">
            <a
              href={githubCreatorLink}
              target="_blank"
              rel="noopener noreferrer"
              className="github-link"
              aria-label="Creator's GitHub Profile"
            >
              {githubSvg}
            </a>
          </div>
        </div>
        <div className="footer-copyright">
          &copy; {currentYear} Ethereal Archives. All rights reserved.
        </div>

        {/* The modal is rendered directly by the Footer component */}
        {this.renderInfoModal()}
      </footer>
    );
  }
}

export default Footer;