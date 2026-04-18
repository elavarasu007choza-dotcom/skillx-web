import { useRef, useState } from "react";

const getEnv = (key, fallback) => {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value : fallback;
};

const getFileTypeFromPath = (fileName) => {
  if (!fileName) return "application/octet-stream";
  const ext = fileName.split(".").pop()?.toLowerCase();
  const mimeTypes = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    zip: "application/zip",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    txt: "text/plain",
  };
  return mimeTypes[ext] || "application/octet-stream";
};

const uploadToCloudinary = async (file) => {
  const cloudName = getEnv("REACT_APP_CLOUDINARY_CLOUD_NAME", "dyvfflwuo");
  const uploadPreset = getEnv("REACT_APP_CLOUDINARY_UPLOAD_PRESET", "skillx_files");
  
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  try {
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
    
    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
      timeout: 30000
    });

    if (!response.ok) {
      const data = await response.json();
      const errorMsg = data.error?.message || data.error || `Upload failed with status ${response.status}`;
      console.error("Cloudinary upload error:", errorMsg);
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const fileUrl = data.secure_url || data.url;
    return fileUrl;
  } catch (err) {
    console.error("Cloudinary upload failed:", err.message);
    throw new Error(`Cloudinary upload failed: ${err.message}`);
  }
};

export default function FileUpload({ chatId, onFileUpload }) {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }

    // Validate file size (100MB limit for Cloudinary)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("File too large! Maximum size is 100MB.");
      e.target.value = "";
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      setUploadProgress(30);
      
      const url = await uploadToCloudinary(file);
      setUploadProgress(100);

      // Determine file type
      const fileType = file.type || getFileTypeFromPath(file.name);

      // Pass file data back to parent
      if (onFileUpload) {
        const fileData = {
          fileUrl: url,
          fileName: file.name,
          fileType: fileType,
        };
        onFileUpload(fileData);
      }

      e.target.value = "";
    } catch (error) {
      console.error("File upload failed:", error);
      alert(`File upload failed: ${error.message}`);
      e.target.value = "";
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClick = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isUploading}
      style={{
        cursor: isUploading ? "not-allowed" : "pointer",
        fontSize: "20px",
        background: "none",
        border: "none",
        padding: 0,
        opacity: isUploading ? 0.6 : 1,
        position: "relative"
      }}
      title={isUploading ? `Uploading... ${uploadProgress}%` : "Upload file"}
    >
      {isUploading ? "⏳" : "📎"}
      {isUploading && (
        <div style={{
          position: "absolute",
          bottom: "-4px",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: "10px",
          color: "#666"
        }}>
          {uploadProgress}%
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFile}
        style={{ display: "none" }}
        disabled={isUploading}
      />
    </button>
  );
}
