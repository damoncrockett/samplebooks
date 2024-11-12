import React, { useState, useEffect, useRef } from 'react';
import imagePaths from '../assets/json/impaths_all.json';
import tombstone from '../assets/json/tombstone.json';
import Login from './Login';
import Instructions from './Instructions';
import CropBox from './CropBox';
import { returnDomain } from '../utils/returnDomain';

export default function App() {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [showInstructions, setShowInstructions] = useState(true);
    const [localCropCoordinates, setLocalCropCoordinates] = useState({});
    const [savedCropCoordinates, setSavedCropCoordinates] = useState({});
    const [totalImages] = useState(imagePaths.length);
    const [unsavedCounts, setUnsavedCounts] = useState({ before: 0, after: 0 });
    const [isCurrentCropSaved, setIsCurrentCropSaved] = useState(false);
    const imageRef = useRef(null);

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
            setIsCurrentCropSaved(false);  // Reset saved state immediately when fetching
            const response = await fetch(
                `${returnDomain('api')}/api/crop_coordinates/${imagePaths[imageIndex]}`,
                { credentials: 'include' }
            );
            if (response.ok) {
                const data = await response.json();
                if (data.coordinates) {
                    setSavedCropCoordinates(prev => ({
                        ...prev,
                        [imagePaths[imageIndex]]: data.coordinates
                    }));
                    setIsCurrentCropSaved(data.coordinates.is_saved);
                } else {
                    setSavedCropCoordinates(prev => ({
                        ...prev,
                        [imagePaths[imageIndex]]: null
                    }));
                    setIsCurrentCropSaved(false);
                }
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

    const handleImageClick = (e) => {
        const currentImage = imagePaths[currentImageIndex];
        if (!savedCropCoordinates[currentImage] && !localCropCoordinates[currentImage]) {
            const rect = e.target.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            const newCoordinates = {
                x: Math.max(0, Math.min(1, x - 0.1)),
                y: Math.max(0, Math.min(1, y - 0.1)),
                width: 0.2,
                height: 0.2
            };
            setLocalCropCoordinates(prev => ({
                ...prev,
                [currentImage]: newCoordinates
            }));
            setIsCurrentCropSaved(false);
        }
    };

    const updateCropCoordinates = (coordinates) => {
        const currentImage = imagePaths[currentImageIndex];
        setLocalCropCoordinates(prev => ({
            ...prev,
            [currentImage]: coordinates
        }));
        setIsCurrentCropSaved(false);
        fetchStats();
    };

    const saveCrop = async () => {
        const currentImage = imagePaths[currentImageIndex];
        const coordinates = getCurrentCoordinates();
        
        if (!coordinates) {
            alert('Please create a crop box before saving');
            return;
        }
    
        console.log('Saving crop for:', currentImage);
        console.log('Normalized coordinates:', {
            x: coordinates.x.toFixed(4),
            y: coordinates.y.toFixed(4),
            width: coordinates.width.toFixed(4),
            height: coordinates.height.toFixed(4)
        });
    
        try {
            const response = await fetch(
                `${returnDomain('api')}/api/save_crop/${currentImage}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ coordinates })
                }
            );
            
            if (response.ok) {
                setSavedCropCoordinates(prev => ({
                    ...prev,
                    [currentImage]: coordinates
                }));
                // Remove from local coordinates since it's now saved
                setLocalCropCoordinates(prev => {
                    const newLocal = { ...prev };
                    delete newLocal[currentImage];
                    return newLocal;
                });
                setIsCurrentCropSaved(true);
                findNextUnsaved('forward');
            }
        } catch (error) {
            console.error('Error saving crop:', error);
        }
    };

    const handleNavigation = (newIndex) => {
        if (newIndex !== currentImageIndex) {
            // Clear states before navigation
            setIsCurrentCropSaved(false);
            setLocalCropCoordinates({});  // Clear all local coordinates
            
            setCurrentImageIndex(newIndex);
            updatePosition(newIndex);
            fetchCropCoordinates(newIndex);
        }
    };

    const handleKeyPress = (event) => {
        if (event.key === 'ArrowRight') {
            const newIndex = Math.min(currentImageIndex + 1, imagePaths.length - 1);
            handleNavigation(newIndex);
        } else if (event.key === 'ArrowLeft') {
            const newIndex = Math.max(currentImageIndex - 1, 0);
            handleNavigation(newIndex);
        } else if (event.key === 'Enter' || event.key === 's') {
            saveCrop();
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
                    handleNavigation(data.next_index);
                } else {
                    alert('No more unsaved images!');
                }
            }
        } catch (error) {
            console.error('Error finding next unsaved:', error);
        }
    };

    useEffect(() => {
        window.addEventListener('keydown', handleKeyPress);
        return () => {
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, [currentImageIndex, localCropCoordinates, savedCropCoordinates]);

    const getCurrentCoordinates = () => {
        const currentImage = imagePaths[currentImageIndex];
        return localCropCoordinates[currentImage] || savedCropCoordinates[currentImage];
    };

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
                    {getCurrentCoordinates() && (
                        <CropBox 
                            coordinates={getCurrentCoordinates()}
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