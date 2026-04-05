export default function FilePreview({ fileUrl, fileName }) {

  const isImage = fileName.match(/\.(jpg|jpeg|png|gif)$/i);

  return (
    <div>

      {isImage ? (
        <img src={fileUrl} alt="img" style={{ width: "150px", borderRadius: "8px" }} />
      ) : (
        <a href={fileUrl} target="_blank" rel="noreferrer">
          📎 {fileName}
        </a>
      )}

    </div>
  );
}