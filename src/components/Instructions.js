import React from 'react';

export default function Instructions({ onClose }) {
    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-text">
                    <p>Welcome! Here's how to use this tool:</p>
                    <ul>
                        <li>Use the arrow buttons or keys to move through the images</li>
                        <li>Click anywhere to create a crop box</li>
                        <li>The crop box can be moved and resized</li>
                        <li>You can always come back to images you've cropped</li>
                        <li>You can skip to the next uncropped image in either direction, too</li>
                    </ul>
                </div>
                <button onClick={onClose}>Ok, got it!</button>
            </div>
        </div>
    );
}