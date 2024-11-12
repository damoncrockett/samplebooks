import React from 'react';

export default function Instructions({ onClose }) {
    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-text">
                    <p>Welcome! Here's how to use this tool:</p>
                    <ul>
                        <li>You can navigate through the images with the arrow keys on your keyboard</li>
                        <li>To create a crop box, click anywhere on the image and one will appear</li>
                        <li>Move the box by dragging, and resize by pulling the dots</li>
                        <li>Once you're happy with it, hit SAVE</li>
                        <li>You can always come back and change it, too</li>
                        <li>There are buttons up top that skip you to the next image that lacks a saved crop box</li>
                        <li>The counters beside those buttons tell you how many images remain without saved crop boxes</li>
                        <li>All your boxes will be saved across sessions!</li>
                    </ul>
                </div>
                <button onClick={onClose}>Ok, got it!</button>
            </div>
        </div>
    );
}