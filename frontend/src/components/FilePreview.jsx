import { useState } from "react";

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif|jfif|heic|heif)$/i;
const PDF_EXTENSIONS = /\.(pdf)$/i;

const getFileIcon = (fileType, fileName) => {
  if (fileType?.includes("pdf") || PDF_EXTENSIONS.test(fileName || "")) return "📄";
  if (fileType?.includes("word") || fileName?.endsWith(".doc") || fileName?.endsWith(".docx")) return "📝";
  if (fileType?.includes("sheet") || fileName?.endsWith(".xls") || fileName?.endsWith(".xlsx")) return "📊";
  if (fileType?.includes("video") || fileName?.match(/\.(mp4|avi|mov|mkv)$/i)) return "🎥";
  if (fileType?.includes("audio") || fileName?.match(/\.(mp3|wav|m4a|aac)$/i)) return "🎵";
  if (fileType?.includes("zip") || fileName?.match(/\.(zip|rar|7z)$/i)) return "📦";
  return "📎";
};

export default function FilePreview({ fileUrl, fileName, fileType }) {
  const [isPdfHovered, setIsPdfHovered] = useState(false);
  const [isFileHovered, setIsFileHovered] = useState(false);

  const safeName = fileName || "Attachment";
  
  // Check PDF FIRST before checking other file types
  const isPDF = fileType?.includes("pdf") || PDF_EXTENSIONS.test(fileName || "");
  
  const handlePdfClick = (e) => {
    e.preventDefault();
    
    // For Cloudinary URLs, add ?dl=true to force download
    const downloadUrl = fileUrl.includes("cloudinary.com")
      ? `${fileUrl.split("?")[0]}?dl=true`
      : fileUrl;
    
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = safeName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  if (isPDF) {
    return (
      <a 
        href={fileUrl} 
        onClick={handlePdfClick}
        onMouseEnter={() => setIsPdfHovered(true)}
        onMouseLeave={() => setIsPdfHovered(false)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "12px",
          padding: "14px 16px",
          backgroundColor: isPdfHovered ? "#efefef" : "#f5f5f5",
          border: "1px solid #ddd",
          borderRadius: "8px",
          textDecoration: "none",
          color: "#333",
          fontWeight: "500",
          cursor: "pointer",
          transition: "all 0.2s ease",
          boxShadow: isPdfHovered ? "0 4px 12px rgba(0,0,0,0.15)" : "0 1px 3px rgba(0,0,0,0.05)",
          transform: isPdfHovered ? "translateY(-2px)" : "translateY(0)",
          maxWidth: "280px"
        }}
      >
        <span style={{ fontSize: "28px", flexShrink: 0 }}>📄</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: "bold", fontSize: "14px", wordBreak: "break-word", marginBottom: "4px" }}>
            {safeName}
          </div>
          <div style={{ fontSize: "12px", color: "#666" }}>
            PDF • Download
          </div>
        </div>
        <span style={{ fontSize: "20px", flexShrink: 0 }}>⬇️</span>
      </a>
    );
  }

  // Now check for images (only if NOT a PDF)
  const fromType = typeof fileType === "string" && fileType.startsWith("image/");
  const fromName = typeof fileName === "string" && IMAGE_EXTENSIONS.test(fileName);
  const isImage = fromType || fromName;

  if (isImage) {
    // Wrap image preview in an anchor so it's clearly clickable and opens in new tab
    const imgHref = fileUrl.includes("cloudinary.com") ? `${fileUrl.split("?")[0]}` : fileUrl;
    return (
      <a href={imgHref} target="_blank" rel="noreferrer" title="Open image in new tab">
        <img
          src={fileUrl}
          alt={safeName}
          style={{ 
            maxWidth: "200px", 
            maxHeight: "200px",
            borderRadius: "8px", 
            objectFit: "cover",
            cursor: "pointer",
            border: "1px solid rgba(0,0,0,0.06)"
          }}
        />
      </a>
    );
  }

  // Default file card for other file types
  const fileIcon = getFileIcon(fileType, fileName);

  return (
    <a 
      href={fileUrl} 
      target="_blank" 
      rel="noreferrer"
      onMouseEnter={() => setIsFileHovered(true)}
      onMouseLeave={() => setIsFileHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "12px",
        padding: "14px 16px",
        backgroundColor: isFileHovered ? "#bbdefb" : "#e3f2fd",
        border: `1px solid ${isFileHovered ? "#64b5f6" : "#90caf9"}`,
        borderRadius: "8px",
        textDecoration: "none",
        color: "#1565c0",
        fontWeight: "500",
        cursor: "pointer",
        transition: "all 0.2s ease",
        boxShadow: isFileHovered ? "0 4px 12px rgba(21, 101, 192, 0.25)" : "0 1px 3px rgba(21, 101, 192, 0.1)",
        transform: isFileHovered ? "translateY(-2px)" : "translateY(0)",
        maxWidth: "280px"
      }}
    >
      <span style={{ fontSize: "28px", flexShrink: 0 }}>{fileIcon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: "bold", fontSize: "14px", wordBreak: "break-word", marginBottom: "4px" }}>
          {safeName}
        </div>
        <div style={{ fontSize: "12px", color: "#1565c0" }}>
          File • Open
        </div>
      </div>
      <span style={{ fontSize: "20px", flexShrink: 0 }}>📤</span>
    </a>
  );
}
