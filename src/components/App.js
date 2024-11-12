import React, { useState, useEffect, useRef } from 'react';
import imagePaths from '../assets/json/impaths_all.json';
import tombstone from '../assets/json/tombstone.json';
import Login from './Login';
import Instructions from './Instructions';

export function returnDomain(type) {
    const production = process.env.NODE_ENV === 'production';
    
    if (type === 'image') {
        return production ? '' : 'http://localhost:8888/';
    } else if (type === 'api') {
        return production 
            ? 'https://fierce-earth-72469-f6228ef670f9.herokuapp.com'
            : 'http://localhost:3001';
    }
    return '';
}

const CropBox = ({ coordinates, setCoordinates, imageRef }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [resizing, setResizing] = useState(null);
    const boxRef = useRef(null);

    const getPixelCoords = () => {
        if (!imageRef.current) return { x: 0, y: 0, width: 0, height: 0 };
        const { offsetWidth: displayWidth, offsetHeight: displayHeight } = imageRef.current;
        
        return {
            x: coordinates.x * displayWidth,
            y: coordinates.y * displayHeight,
            width: coordinates.width * displayWidth,
            height: coordinates.height * displayHeight
        };
    };

    const normalizeCoordinates = (pixelX, pixelY, pixelWidth, pixelHeight) => {
        if (!imageRef.current) return coordinates;
        const { offsetWidth: displayWidth, offsetHeight: displayHeight } = imageRef.current;
        
        return {
            x: Math.max(0, Math.min(1, pixelX / displayWidth)),
            y: Math.max(0, Math.min(1, pixelY / displayHeight)),
            width: Math.max(0, Math.min(1, pixelWidth / displayWidth)),
            height: Math.max(0, Math.min(1, pixelHeight / displayHeight))
        };
    };

    const handleMouseDown = (e, handle = null) => {
        e.stopPropagation();
        const { clientX, clientY } = e;
        setDragStart({ x: clientX, y: clientY });
        
        if (handle) {
            setResizing(handle);
        } else {
            setIsDragging(true);
        }
    };

    const handleMouseMove = (e) => {
        if (!isDragging && !resizing) return;
        
        const { clientX, clientY } = e;
        const deltaX = clientX - dragStart.x;
        const deltaY = clientY - dragStart.y;
        const pixelCoords = getPixelCoords();

        if (isDragging) {
            const newCoords = normalizeCoordinates(
                pixelCoords.x + deltaX,
                pixelCoords.y + deltaY,
                pixelCoords.width,
                pixelCoords.height
            );
            setCoordinates(newCoords);
        } else if (resizing) {
            let newX = pixelCoords.x;
            let newY = pixelCoords.y;
            let newWidth = pixelCoords.width;
            let newHeight = pixelCoords.height;

            switch (resizing) {
                case 'n':
                    newY += deltaY;
                    newHeight -= deltaY;
                    break;
                case 's':
                    newHeight += deltaY;
                    break;
                case 'e':
                    newWidth += deltaX;
                    break;
                case 'w':
                    newX += deltaX;
                    newWidth -= deltaX;
                    break;
                case 'nw':
                    newX += deltaX;
                    newY += deltaY;
                    newWidth -= deltaX;
                    newHeight -= deltaY;
                    break;
                case 'ne':
                    newY += deltaY;
                    newWidth += deltaX;
                    newHeight -= deltaY;
                    break;
                case 'sw':
                    newX += deltaX;
                    newWidth -= deltaX;
                    newHeight += deltaY;
                    break;
                case 'se':
                    newWidth += deltaX;
                    newHeight += deltaY;
                    break;
            }

            const newCoords = normalizeCoordinates(newX, newY, newWidth, newHeight);
            setCoordinates(newCoords);
        }

        setDragStart({ x: clientX, y: clientY });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setResizing(null);
    };

    useEffect(() => {
        if (isDragging || resizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, resizing]);

    const pixelCoords = getPixelCoords();

    return (
        <div
            ref={boxRef}
            className="crop-box"
            style={{
                position: 'absolute',
                left: `${pixelCoords.x}px`,
                top: `${pixelCoords.y}px`,
                width: `${pixelCoords.width}px`,
                height: `${pixelCoords.height}px`,
                cursor: isDragging ? 'grabbing' : 'grab'
            }}
            onMouseDown={(e) => handleMouseDown(e)}
        >
            <div className="resize-handle n" onMouseDown={(e) => handleMouseDown(e, 'n')} />
            <div className="resize-handle s" onMouseDown={(e) => handleMouseDown(e, 's')} />
            <div className="resize-handle e" onMouseDown={(e) => handleMouseDown(e, 'e')} />
            <div className="resize-handle w" onMouseDown={(e) => handleMouseDown(e, 'w')} />
            <div className="resize-handle nw" onMouseDown={(e) => handleMouseDown(e, 'nw')} />
            <div className="resize-handle ne" onMouseDown={(e) => handleMouseDown(e, 'ne')} />
            <div className="resize-handle sw" onMouseDown={(e) => handleMouseDown(e, 'sw')} />
            <div className="resize-handle se" onMouseDown={(e) => handleMouseDown(e, 'se')} />
        </div>
    );
};

export default function App() {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [showInstructions, setShowInstructions] = useState(true);
    const [cropCoordinates, setCropCoordinates] = useState({});
    const [savedImages, setSavedImages] = useState(0);
    const [totalImages] = useState(imagePaths.length);
    const imageRef = useRef(null);
    const [unsavedCounts, setUnsavedCounts] = useState({ before: 0, after: 0 });
    const [isCurrentCropSaved, setIsCurrentCropSaved] = useState(false);

    useEffect(() => {
        const checkAuthAndPosition = async () => {
            try {
                const response = await fetch(`${returnDomain('api')}/api/current_position`, {
                    credentials: 'include'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    setIsLoggedIn(true);
                    setCurrentImageIndex(data.current_position);
                    fetchCropCoordinates(data.current_position);
                    fetchStats();
                } else {
                    setIsLoggedIn(false);
                }
            } catch (error) {
                console.error('Auth check error:', error);
                setIsLoggedIn(false);
            }
        };
        checkAuthAndPosition();
    }, []);

    const fetchStats = async () => {
        try {
            const response = await fetch(
                `${returnDomain('api')}/api/stats/${currentImageIndex}`,
                { credentials: 'include' }
            );
            if (response.ok) {
                const data = await response.json();
                setUnsavedCounts({
                    before: data.unsaved_before,
                    after: data.unsaved_after
                });
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [currentImageIndex]);

    const fetchCropCoordinates = async (imageIndex) => {
        try {
            const response = await fetch(
                `${returnDomain('api')}/api/crop_coordinates/${imagePaths[imageIndex]}`,
                { credentials: 'include' }
            );
            if (response.ok) {
                const data = await response.json();
                if (data.coordinates) {
                    setCropCoordinates(prev => ({
                        ...prev,
                        [imagePaths[imageIndex]]: data.coordinates
                    }));
                    setIsCurrentCropSaved(data.coordinates.is_saved);
                } else {
                    // No coordinates found for this image
                    setCropCoordinates(prev => ({
                        ...prev,
                        [imagePaths[imageIndex]]: null
                    }));
                    setIsCurrentCropSaved(false);
                }
            } else {
                // Response not OK - reset states
                setCropCoordinates(prev => ({
                    ...prev,
                    [imagePaths[imageIndex]]: null
                }));
                setIsCurrentCropSaved(false);
            }
        } catch (error) {
            console.error('Error fetching crop coordinates:', error);
            setIsCurrentCropSaved(false);
        }
    };

    const updatePosition = async (newIndex) => {
        try {
            const response = await fetch(`${returnDomain('api')}/api/update_position`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    position: newIndex
                })
            });
            
            if (!response.ok) {
                console.error('Failed to update position');
            }
        } catch (error) {
            console.error('Error updating position:', error);
        }
    };

    const updateCropCoordinates = async (coordinates) => {
        try {
            const response = await fetch(
                `${returnDomain('api')}/api/crop_coordinates/${imagePaths[currentImageIndex]}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ coordinates })
                }
            );
            if (response.ok) {
                setCropCoordinates(prev => ({
                    ...prev,
                    [imagePaths[currentImageIndex]]: coordinates
                }));
                setIsCurrentCropSaved(false);  // Reset saved status when coordinates change
                fetchStats();  // Update counts since we've made a crop unsaved
            }
        } catch (error) {
            console.error('Error updating crop coordinates:', error);
        }
    };

    const handleImageClick = (e) => {
        if (!cropCoordinates[imagePaths[currentImageIndex]]) {
            const rect = e.target.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            const newCoordinates = {
                x: Math.max(0, Math.min(1, x - 0.1)),
                y: Math.max(0, Math.min(1, y - 0.1)),
                width: 0.2,
                height: 0.2
            };
            updateCropCoordinates(newCoordinates);
        }
    };

    const saveCrop = async () => {
        if (!cropCoordinates[imagePaths[currentImageIndex]]) {
            alert('Please create a crop box before saving');
            return;
        }
    
        const coords = cropCoordinates[imagePaths[currentImageIndex]];
        console.log('Saving crop for:', imagePaths[currentImageIndex]);
        console.log('Normalized coordinates:', {
            x: coords.x.toFixed(4),
            y: coords.y.toFixed(4),
            width: coords.width.toFixed(4),
            height: coords.height.toFixed(4)
        });
    
        try {
            const response = await fetch(
                `${returnDomain('api')}/api/save_crop/${imagePaths[currentImageIndex]}`,
                {
                    method: 'POST',
                    credentials: 'include'
                }
            );
            if (response.ok) {
                setSavedImages(prev => prev + 1);
                findNextUnsaved('forward');
            }
        } catch (error) {
            console.error('Error saving crop:', error);
        }
    };

    const findNextUnsaved = async (direction) => {
        try {
            const response = await fetch(
                `${returnDomain('api')}/api/next_unsaved/${currentImageIndex}/${direction}`,
                { credentials: 'include' }
            );
            
            if (response.ok) {
                const data = await response.json();
                if (data.next_index !== null) {
                    setCurrentImageIndex(data.next_index);
                    updatePosition(data.next_index);
                    fetchCropCoordinates(data.next_index);
                } else {
                    alert('No more unsaved images!');
                }
            }
        } catch (error) {
            console.error('Error finding next unsaved:', error);
        }
    };

    const handleKeyPress = (event) => {
        if (event.key === 'ArrowRight') {
            const newIndex = Math.min(currentImageIndex + 1, imagePaths.length - 1);
            if (newIndex !== currentImageIndex) {
                setCurrentImageIndex(newIndex);
                updatePosition(newIndex);
                fetchCropCoordinates(newIndex);
            }
        } else if (event.key === 'ArrowLeft') {
            const newIndex = Math.max(currentImageIndex - 1, 0);
            if (newIndex !== currentImageIndex) {
                setCurrentImageIndex(newIndex);
                updatePosition(newIndex);
                fetchCropCoordinates(newIndex);
            }
        } else if (event.key === 'Enter' || event.key === 's') {
            saveCrop();
        }
    };

    useEffect(() => {
        window.addEventListener('keydown', handleKeyPress);
        return () => {
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, [currentImageIndex, cropCoordinates]);

    const currentImageBasename = imagePaths[currentImageIndex].split('/').pop().replace(/\.[^/.]+$/, "");

    if (!isLoggedIn) {
        return <Login onLogin={setIsLoggedIn} />;
    }

    return (
        <div className="app-container">
            {showInstructions && (
                <Instructions onClose={() => setShowInstructions(false)} />
            )}
            <div id="controls">
                <div className="unsaved-count before">
                    {unsavedCounts.before}
                </div>
                <button 
                    onClick={() => findNextUnsaved('backward')}
                    title="Go to previous unsaved image"
                >
                    ← PREV UNSAVED
                </button>
                <button 
                    onClick={saveCrop}
                    className={`save-button ${isCurrentCropSaved ? 'saved' : ''}`}
                    title={isCurrentCropSaved ? "Crop saved - click to update" : "Save crop (or press 's')"}
                >
                    {isCurrentCropSaved ? 'UPDATE' : 'SAVE'}
                </button>
                <button 
                    onClick={() => findNextUnsaved('forward')}
                    title="Go to next unsaved image"
                >
                    NEXT UNSAVED →
                </button>
                <div className="unsaved-count after">
                    {unsavedCounts.after}
                </div>
            </div>
    
            <div className="image-container">
                <div className="image-wrapper">
                    <img 
                        ref={imageRef}
                        src={returnDomain('image') + 'img/' + imagePaths[currentImageIndex]} 
                        alt={`Image ${currentImageIndex + 1}`}
                        onClick={handleImageClick}
                    />
                    {cropCoordinates[imagePaths[currentImageIndex]] && (
                        <CropBox 
                            coordinates={cropCoordinates[imagePaths[currentImageIndex]]}
                            setCoordinates={updateCropCoordinates}
                            imageRef={imageRef}
                        />
                    )}
                </div>
            </div>

            <div id="image-counter">
                <div className="image-description">
                    {tombstone[imagePaths[currentImageIndex]] || 'No description available'}
                </div>
                <div className="image-number">
                    {currentImageIndex + 1} / {totalImages}
                </div>
            </div>
        </div>
    );
}