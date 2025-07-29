import React from 'react';
import Lottie from 'lottie-react';
import loadingAnimation from './assets/loading.json';
import { supabase } from '../supabaseClient';
import JSZip from "jszip";
import './Download.css'; // Assuming you have some styles in Download.css

class Download extends React.Component {
  state = {
    code: "",
    loading: false,
    files: [],
    showFiles: false,
    error: null,
  };

  handleCodeChange = (e) => {
    this.setState({ code: e.target.value });
  };

  handleDownload = async () => {
    const { code } = this.state;
    if (!code) return;
    this.setState({ loading: true, error: null });

    try {
      // Fetch file names from Supabase
      const { data, error } = await supabase
        .from('transfers')
        .select('file_names, created_at, time_limit')
        .eq('code', code)
        .single();

      if (error || !data) throw new Error("Invalid code or no files found.");

      // Check expiry
      function getExpiryDate(created_at, time_limit) {
        const created = new Date(created_at);
        if (time_limit === "1h") created.setHours(created.getHours() + 1);
        else if (time_limit === "1d") created.setDate(created.getDate() + 1);
        else if (time_limit === "1w") created.setDate(created.getDate() + 7);
        return created;
      }

      const expiry = getExpiryDate(data.created_at, data.time_limit);
      if (new Date() > expiry) {
        this.setState({ loading: false, error: "This code has expired.", showFiles: false });
        return;
      }

      // Generate signed URLs for all files
      const files = await Promise.all(
        data.file_names.map(async (fileName) => {
          const { data: signedData, error: signedError } = await supabase
            .storage
            .from('files')
            .createSignedUrl(`${code}/${fileName}`, 60 * 5); // 5-minute validity

          if (signedError) throw signedError;
          return { name: fileName, url: signedData.signedUrl };
        })
      );

      this.setState({ loading: false, files, showFiles: true, error: null });
    } catch (err) {
      this.setState({ loading: false, error: err.message });
    }
  };

  handleDownloadFile = async (file) => {
    const zip = new JSZip();
    try {
      const response = await fetch(file.url);
      if (!response.ok) throw new Error(`Failed to fetch ${file.name}`);
      const blob = await response.blob();
      zip.file(file.name, blob);

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `${file.name.replace(/\.[^/.]+$/, "")}.zip`; // e.g. photo1.zip
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("Failed to download file: " + err.message);
    }
  };

  handleDownloadAll = async () => {
    const { files } = this.state;
    if (!files.length) return;
    console.log("Starting zip...");
    const zip = new JSZip();

    await Promise.all(
      files.map(async (file) => {
        const response = await fetch(file.url);
        const blob = await response.blob();
        zip.file(file.name, blob);
      })
    );

    const content = await zip.generateAsync({ type: "blob" });
    console.log("Zip ready, triggering download...");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = "files.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  render() {
    const { code, loading, files, showFiles, error } = this.state;

    return (
      <div className="download-page">
        {/* Code Input Card */}
        {!showFiles && (
          <div className="card download-card text-center shadow">
            <div className="card-header">DOWNLOAD</div>
            <div className="card-body">
              <h5 className="card-title">Enter Your Code</h5>
              <input
                type="text"
                className="form-control mb-3"
                placeholder="Enter special code"
                value={code}
                onChange={this.handleCodeChange}
                maxLength={16}
              />
              <button
                className="btn btn-download"
                onClick={this.handleDownload}
                disabled={!code || loading}
              >
                {loading ? (
                  <span>
                    <Lottie animationData={loadingAnimation} style={{ width: 30, height: 30, display: "inline-block" }} />
                    Loading...
                  </span>
                ) : "Download"}
              </button>
              {error && <div className="alert alert-danger mt-3">{error}</div>}
            </div>
            <div className="card-footer text-body-secondary">
              Enter the code you received to access your files.
            </div>
          </div>
        )}

        {/* Files Preview Card */}
        {showFiles && (
          <div className="card files-card shadow">
            <div className="card-header text-center d-flex justify-content-between align-items-center">
              <span>Files</span>
              <button className="btn btn-primary btn-sm" onClick={this.handleDownloadAll}>
                Download All
              </button>
            </div>
            <div className="card-body">
              {files.length === 0 ? (
                <div>No files found for this code.</div>
              ) : (
                <ul className="file-list">
                  {files.map((file, idx) => (
                    <li key={idx} className="file-list-item">
                      {file.name}
                      <button
                        className="btn btn-outline-success btn-sm"
                        onClick={() => this.handleDownloadFile(file)}
                      >
                        Download
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default Download;