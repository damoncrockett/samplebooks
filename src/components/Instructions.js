import React from 'react';

export default function Instructions({ onClose }) {
    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-text">
                    <p>Welcome! Here's how to use this tool:</p>
                    <ul>
                        <li>Each image has two different AI-generated captions</li>
                        <li>Click the caption you think better describes the image</li>
                        <li>You can rotate the image using the ⟲ and ⟳ buttons</li>
                        <li>Pan the image by dragging it</li>
                        <li>Zoom using your mouse wheel or pinch gesture</li>
                        <li>Click STATS to see how different models are performing</li>
                    </ul>
                </div>
                <button onClick={onClose}>Ok, got it!</button>
            </div>
        </div>
    );
}