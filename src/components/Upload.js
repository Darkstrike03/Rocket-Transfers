import React from 'react';
import Lottie from 'lottie-react';
import loadingAnimation from './assets/loading.json';
import { supabase } from '../supabaseClient';
import './Upload.css';

const TIME_OPTIONS = [
  { label: "1 Hour", value: "1h" },
  { label: "1 Day", value: "1d" },
  { label: "1 Week", value: "1w" },
];

function generateSpecialCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

class Upload extends React.Component {
  state = {
    selectedFiles: [],
    timeLimit: TIME_OPTIONS[0].value,
    uploading: false,
    uploadedFiles: [],
    done: false,
    specialCode: "",
    error: null,
  };

  handleFileChange = (e) => {
    this.setState({ selectedFiles: Array.from(e.target.files) });
  };

  handleTimeChange = (e) => {
    this.setState({ timeLimit: e.target.value });
  };

  handleUpload = async () => {
    const { selectedFiles, timeLimit } = this.state;
    if (!selectedFiles.length) return;
    this.setState({ uploading: true, error: null });

    const code = generateSpecialCode();
    const uploadedFiles = [];

    try {
      for (const file of selectedFiles) {
        const { error } = await supabase
          .storage
          .from('files')
          .upload(`${code}/${file.name}`, file);
        if (error) throw error;
        uploadedFiles.push({ file, timeLimit });
      }

      const { error: dbError } = await supabase
        .from('transfers')
        .insert([
          {
            code,
            file_names: selectedFiles.map(f => f.name),
            time_limit: timeLimit,
          }
        ]);

      if (dbError) throw dbError;

      this.setState({
        uploading: false,
        uploadedFiles: uploadedFiles,
        selectedFiles: [],
        specialCode: code,
        done: false,
        error: null,
      });
    } catch (err) {
      this.setState({ uploading: false, error: err.message });
    }
  };

  handleRemove = (index) => {
    this.setState((prev) => ({
      uploadedFiles: prev.uploadedFiles.filter((_, i) => i !== index)
    }));
  };

  handleDone = () => {
    this.setState({ done: true });
  };

  render() {
    const { selectedFiles, timeLimit, uploading, uploadedFiles, done, specialCode, error } = this.state;

    return (
      <div className="upload-wrapper">
        {/* Upload Card */}
        {!done && (
          <div className="card text-center shadow upload-card">
            <div className="card-header">UPLOADS</div>
            <div className="card-body">
              <h5 className="card-title">Just UPLOAD</h5>
              <p className="card-text">
                Upload your content here, set the time and just wait for the magic to happen.
              </p>
              <input
                type="file"
                className="form-control mb-3"
                onChange={this.handleFileChange}
                style={{ display: 'none' }}
                id="fileInput"
                multiple
              />
              <div className="d-flex justify-content-center gap-2 mb-3">
                <label htmlFor="fileInput" className="btn btn-primary mb-0">
                  {selectedFiles.length ? `${selectedFiles.length} File(s) Selected` : "Choose File(s)"}
                </label>
                <select
                  className="form-select w-auto"
                  value={timeLimit}
                  onChange={this.handleTimeChange}
                >
                  {TIME_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <button
                className="btn btn-upload"
                onClick={this.handleUpload}
                disabled={!selectedFiles.length || uploading}
              >
                {uploading ? (
                  <span>
                    <Lottie animationData={loadingAnimation} style={{ width: 30, height: 30, display: "inline-block" }} />
                    Uploading...
                  </span>
                ) : "Upload!"}
              </button>
              {error && <div className="alert alert-danger mt-3">{error}</div>}
            </div>
            <div className="card-footer text-body-secondary">
              Remember to set your time, default time limit is 1 hour.
            </div>
          </div>
        )}

        {/* Preview Card */}
        {uploadedFiles.length > 0 && !done && (
          <div className="card shadow preview-card">
            <div className="card-header text-center">Preview</div>
            <div className="card-body">
              {uploadedFiles.map((item, idx) => (
                <div key={idx} className="mb-3 border-bottom pb-2">
                  <h6 className="card-title mb-1">{item.file.name}</h6>
                  <p className="card-text mb-1" style={{ fontSize: "0.95rem" }}>
                    Time Limit: {TIME_OPTIONS.find(opt => opt.value === item.timeLimit)?.label}
                  </p>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => this.handleRemove(idx)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="card-footer text-center">
              <button className="btn btn-primary" onClick={this.handleDone}>
                Done
              </button>
            </div>
          </div>
        )}

        {/* Done Card with QR */}
        {done && (
          <div className="card shadow done-card">
            <div className="card-body d-flex flex-column flex-md-row w-100">
              <div className="flex-grow-1 pe-md-4 border-md-end">
                <h5 className="mb-3">Uploaded Files</h5>
                {uploadedFiles.length === 0 ? (
                  <div>No files uploaded.</div>
                ) : (
                  <ul className="list-group">
                    {uploadedFiles.map((item, idx) => (
                      <li key={idx} className="list-group-item d-flex justify-content-between align-items-center">
                        {item.file.name}
                        <span className="badge bg-secondary">{TIME_OPTIONS.find(opt => opt.value === item.timeLimit)?.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="qr-section mt-4 mt-md-0">
                <h5 className="mb-3">Share</h5>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${specialCode}`}
                  alt="QR Code"
                  style={{ width: 150, height: 150, marginBottom: 16 }}
                />
                <div className="mt-2">
                  <span className="badge bg-dark" style={{ fontSize: "1.2rem", letterSpacing: "2px" }}>
                    {specialCode}
                  </span>
                </div>
                <div className="text-muted mt-2" style={{ fontSize: "0.9rem" }}>
                  Use this code to download your files.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default Upload;
