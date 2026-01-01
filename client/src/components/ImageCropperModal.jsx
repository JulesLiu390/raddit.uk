import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import './ImageCropperModal.css';

// Canvas helper function
const getCroppedImg = (imageSrc, pixelCrop) => {
  const createImage = (url) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  return new Promise(async (resolve, reject) => {
    try {
      const image = await createImage(imageSrc);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return reject(new Error('No 2d context'));
      }

      // Set canvas size to match the cropped area
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;

      // Draw the cropped image
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );

      // Export as Blob
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        blob.name = 'cropped.jpeg';
        resolve(blob);
      }, 'image/jpeg');
    } catch (e) {
      reject(e);
    }
  });
};

const ImageCropperModal = ({ imageSrc, aspect = 1, cropShape = 'rect', onCancel, onCropComplete, uploading = false }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropChange = (crop) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom) => {
    setZoom(zoom);
  };

  const onCropCompleteHandler = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(croppedBlob);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="crop-modal-overlay">
      <div className="crop-modal-content">
        <div className="crop-container">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={cropShape}
            onCropChange={onCropChange}
            onCropComplete={onCropCompleteHandler}
            onZoomChange={onZoomChange}
            showGrid={true}
          />
        </div>
        <div className="crop-controls">
          <div className="zoom-slider-container">
            <span>缩放</span>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(e.target.value)}
              className="zoom-range"
            />
          </div>
          <div className="button-container">
            <button onClick={onCancel} className="cancel-btn" disabled={uploading}>
              取消
            </button>
            <button onClick={handleSave} className="save-btn" disabled={uploading}>
              {uploading ? '上传中...' : '确认裁剪'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropperModal;
