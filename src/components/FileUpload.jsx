import { useRef, useState } from "react";

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
  const cloudName = "dyvfflwuo";
  const uploadPreset = "skillx_files";
  
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  try {
    console.log("📤 Starting Cloudinary upload...");
    console.log("   Cloud Name:", cloudName);
    console.log("   Upload Preset:", uploadPreset);
    console.log("   File Name:", file.name);
    console.log("   File Type:", file.type);
    console.log("   File Size:", (file.size / 1024 / 1024).toFixed(2), "MB");
    
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
    console.log("   Upload URL:", uploadUrl);
    
    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
      timeout: 30000
    });

    console.log("📥 Cloudinary response status:", response.status);
    
    const data = await response.json();
    console.log("📥 Cloudinary response data:", data);

    if (!response.ok) {
      const errorMsg = data.error?.message || data.error || `Upload failed with status ${response.status}`;
      console.error("❌ Cloudinary error:", errorMsg);
      throw new Error(errorMsg);
    }

    const fileUrl = data.secure_url || data.url;
    console.log("✅ File uploaded successfully to Cloudinary:");
    console.log("   URL:", fileUrl);
    return fileUrl;
  } catch (err) {
    console.error("❌ Cloudinary upload failed:", err.message);
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
      console.log("No file selected");
      return;
    }

    console.log("File selected:", file.name, file.size, file.type);

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
      console.log("🚀 Starting Cloudinary upload for:", file.name);
      
      const url = await uploadToCloudinary(file);
      setUploadProgress(100);

      console.log("File uploaded successfully:", url);

      // Determine file type
      const fileType = file.type || getFileTypeFromPath(file.name);
      console.log("File type resolved:", fileType);

      // Pass file data back to parent
      if (onFileUpload) {
        const fileData = {
          fileUrl: url,
          fileName: file.name,
          fileType: fileType,
        };
        console.log("✅ Calling onFileUpload with:", fileData);
        onFileUpload(fileData);
      }

      e.target.value = "";
    } catch (error) {
      console.error("❌ Upload failed:", error);
      alert(`❌ File upload failed: ${error.message}`);
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
