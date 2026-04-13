import { useState } from "react";
import { supabase } from "../supabase";

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif|jfif|heic|heif)$/i;
const PDF_EXTENSIONS = /\.(pdf)$/i;
const VIDEO_EXTENSIONS = /\.(mp4|avi|mov|mkv|webm)$/i;
const AUDIO_EXTENSIONS = /\.(mp3|wav|m4a|aac|ogg)$/i;

const getFileIcon = (fileType, fileName) => {
  if (fileType?.includes("pdf") || PDF_EXTENSIONS.test(fileName || "")) return "📄";
  if (fileType?.includes("word") || fileName?.endsWith(".doc") || fileName?.endsWith(".docx")) return "📝";
  if (fileType?.includes("sheet") || fileName?.endsWith(".xls") || fileName?.endsWith(".xlsx")) return "📊";
  if (fileType?.includes("video") || VIDEO_EXTENSIONS.test(fileName || "")) return "🎥";
  if (fileType?.includes("audio") || AUDIO_EXTENSIONS.test(fileName || "")) return "🎵";
  if (fileType?.includes("zip") || fileName?.match(/\.(zip|rar|7z)$/i)) return "📦";
  return "📎";
};

export default function FilePreview({ fileUrl, fileName, fileType }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const safeName = fileName || "Attachment";
  const isPDF = fileType?.includes("pdf") || PDF_EXTENSIONS.test(fileName || "");
  const isVideo = fileType?.includes("video") || VIDEO_EXTENSIONS.test(fileName || "");
  const isAudio = fileType?.includes("audio") || AUDIO_EXTENSIONS.test(fileName || "");
  const isImage = (typeof fileType === "string" && fileType.startsWith("image/")) || 
                  (typeof fileName === "string" && IMAGE_EXTENSIONS.test(fileName));

  // Check if it's a Supabase URL
  const isSupabase = fileUrl?.includes("supabase.co");

  const handleDownload = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    setIsDownloading(true);

    try {
      // For Supabase files, use Supabase download
      if (isSupabase) {
        // Extract path from URL (get the file path after /uploads/)
        const urlParts = fileUrl.split('/uploads/');
        const filePath = urlParts[1] || '';
        
        if (filePath) {
          // Download using Supabase
          const { data, error } = await supabase.storage
            .from('uploads')
            .download(filePath);

          if (error) throw error;

          // Create download link from blob
          const blobUrl = window.URL.createObjectURL(data);
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = safeName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        } else {
          // Fallback: direct download
          const link = document.createElement("a");
          link.href = fileUrl;
          link.download = safeName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else {
        // For other URLs (direct download)
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = safeName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }
    } catch (error) {
      console.error("Download failed:", error);
      // Fallback: open in new tab
      window.open(fileUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  // PDF
  if (isPDF) {
    return (
      <div
        onClick={handleDownload}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: "inline-flex", alignItems: "center", gap: "12px", padding: "14px 16px",
          backgroundColor: isHovered ? "#efefef" : "#f5f5f5", border: "1px solid #ddd",
          borderRadius: "8px", cursor: isDownloading ? "wait" : "pointer", 
          transition: "all 0.2s ease",
          boxShadow: isHovered ? "0 4px 12px rgba(0,0,0,0.15)" : "0 1px 3px rgba(0,0,0,0.05)",
          transform: isHovered ? "translateY(-2px)" : "translateY(0)",
          maxWidth: "280px", color: "#333", fontWeight: "500",
          opacity: isDownloading ? 0.7 : 1
        }}
      >
        <span style={{ fontSize: "28px", flexShrink: 0 }}>{isDownloading ? "⏳" : "📄"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: "bold", fontSize: "14px", wordBreak: "break-word", marginBottom: "4px" }}>{safeName}</div>
          <div style={{ fontSize: "12px", color: "#666" }}>{isDownloading ? "Downloading..." : "PDF • Click to download"}</div>
        </div>
        <span style={{ fontSize: "20px", flexShrink: 0 }}>⬇️</span>
      </div>
    );
  }

  // Image - click to download
  if (isImage) {
    return (
      <div
        onClick={handleDownload}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: "inline-block", maxWidth: "200px", maxHeight: "200px", 
          borderRadius: "8px", overflow: "hidden", cursor: isDownloading ? "wait" : "pointer",
          border: isHovered ? "2px solid #4CAF50" : "1px solid rgba(0,0,0,0.06)",
          transition: "all 0.2s ease",
          position: "relative"
        }}
      >
        <img src={fileUrl} alt={safeName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        {isHovered && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", 
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: "8px"
          }}>
            <span style={{ color: "white", fontSize: "24px" }}>
              {isDownloading ? "⏳" : "⬇️"} {isDownloading ? "Downloading..." : "Download"}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Video - inline player with download button
  if (isVideo) {
    return (
      <div style={{ maxWidth: "280px" }}>
        <video src={fileUrl} controls style={{ width: "100%", borderRadius: "8px", border: "1px solid #ddd" }} />
        <div style={{ fontSize: "12px", textAlign: "center", marginTop: "4px", color: "#666", wordBreak: "break-word" }}>{safeName}</div>
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          style={{
            width: "100%", padding: "8px", marginTop: "8px",
            backgroundColor: isDownloading ? "#ccc" : "#4CAF50",
            color: "white", border: "none", borderRadius: "4px",
            cursor: isDownloading ? "wait" : "pointer",
            fontSize: "14px"
          }}
        >
          {isDownloading ? "⏳ Downloading..." : "⬇️ Download Video"}
        </button>
      </div>
    );
  }

  // Audio - inline player with download button
  if (isAudio) {
    return (
      <div style={{ maxWidth: "280px", padding: "10px", backgroundColor: "#f9f9f9", borderRadius: "8px", border: "1px solid #ddd" }}>
        <audio src={fileUrl} controls style={{ width: "100%" }} />
        <div style={{ fontSize: "12px", textAlign: "center", marginTop: "4px", color: "#666", wordBreak: "break-word" }}>{safeName}</div>
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          style={{
            width: "100%", padding: "8px", marginTop: "8px",
            backgroundColor: isDownloading ? "#ccc" : "#4CAF50",
            color: "white", border: "none", borderRadius: "4px",
            cursor: isDownloading ? "wait" : "pointer",
            fontSize: "14px"
          }}
        >
          {isDownloading ? "⏳ Downloading..." : "⬇️ Download Audio"}
        </button>
      </div>
    );
  }

  // Other files
  const fileIcon = getFileIcon(fileType, fileName);
  return (
    <div
      onClick={handleDownload}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: "12px", padding: "14px 16px",
        backgroundColor: isHovered ? "#bbdefb" : "#e3f2fd", border: `1px solid ${isHovered ? "#64b5f6" : "#90caf9"}`,
        borderRadius: "8px", color: "#1565c0", fontWeight: "500",
        cursor: isDownloading ? "wait" : "pointer", transition: "all 0.2s ease",
        boxShadow: isHovered ? "0 4px 12px rgba(21, 101, 192, 0.25)" : "0 1px 3px rgba(21, 101, 192, 0.1)",
        transform: isHovered ? "translateY(-2px)" : "translateY(0)",
        maxWidth: "280px"
      }}
    >
      <span style={{ fontSize: "28px", flexShrink: 0 }}>{isDownloading ? "⏳" : fileIcon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: "bold", fontSize: "14px", wordBreak: "break-word", marginBottom: "4px" }}>{safeName}</div>
        <div style={{ fontSize: "12px", color: "#1565c0" }}>{isDownloading ? "Downloading..." : "Click to download"}</div>
      </div>
      <span style={{ fontSize: "20px", flexShrink: 0 }}>📤</span>
    </div>
  );
}
