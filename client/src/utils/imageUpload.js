/**
 * 上传图片到后端（后端再转发到 ImgBB）
 * @param {File} file - 图片文件
 * @returns {Promise<string>} - 返回图片 URL
 */
export const uploadImageToImgBB = async (file) => {
  try {
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      throw new Error('请选择图片文件');
    }

    // 验证文件大小 (32MB)
    const maxSize = 32 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('图片大小不能超过 32MB');
    }

    // 读取文件为 base64
    const base64 = await fileToBase64(file);

    // 发送到后端（使用相对路径）
    const response = await fetch('/api/upload-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64 }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '上传失败');
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('图片上传失败:', error);
    throw error;
  }
};

/**
 * 将文件转换为 base64
 * @param {File} file
 * @returns {Promise<string>}
 */
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // 保留完整的 data URI (data:image/...;base64,...)
      resolve(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * 触发文件选择并上传
 * @param {Function} onProgress - 进度回调
 * @returns {Promise<string>} - 返回图片 URL
 */
export const selectAndUploadImage = (onProgress) => {
  return new Promise((resolve, reject) => {
    // 创建文件选择器
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) {
        reject(new Error('未选择文件'));
        return;
      }

      try {
        if (onProgress) onProgress('uploading');
        const url = await uploadImageToImgBB(file);
        if (onProgress) onProgress('success');
        resolve(url);
      } catch (error) {
        if (onProgress) onProgress('error');
        reject(error);
      }
    };

    input.click();
  });
};

/**
 * 处理粘贴事件中的图片
 * @param {ClipboardEvent} event - 粘贴事件
 * @param {Function} onUploadStart - 上传开始回调
 * @param {Function} onUploadComplete - 上传完成回调，参数为图片 URL
 * @param {Function} onUploadError - 上传失败回调
 */
export const handlePasteImage = async (event, onUploadStart, onUploadComplete, onUploadError) => {
  const items = event.clipboardData?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // 检查是否为图片
    if (item.type.indexOf('image') !== -1) {
      event.preventDefault(); // 阻止默认粘贴行为
      
      const file = item.getAsFile();
      if (!file) continue;

      try {
        if (onUploadStart) onUploadStart();
        const url = await uploadImageToImgBB(file);
        if (onUploadComplete) onUploadComplete(url);
      } catch (error) {
        console.error('粘贴图片上传失败:', error);
        if (onUploadError) onUploadError(error);
      }
      
      break; // 只处理第一张图片
    }
  }
};
