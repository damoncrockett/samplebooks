import React, { useState, useEffect, useRef } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import captions from '../assets/json/captions_for_web.json';
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

export default function App() {
    const imgPaths = captions.map(item => item.url.split('/').pop());
    
    const [currentImage, setCurrentImage] = useState(null);
    const [captionA, setCaptionA] = useState(null);
    const [captionB, setCaptionB] = useState(null);
    const [modelA, setModelA] = useState(null);
    const [modelB, setModelB] = useState(null);
    const [rotation, setRotation] = useState(0);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [showInstructions, setShowInstructions] = useState(true);

    const transformComponentRef = useRef(null);

    const selectRandomImageAndCaptions = () => {
        // Select random image
        const randomIndex = Math.floor(Math.random() * imgPaths.length);
        const selectedPath = imgPaths[randomIndex];
        
        // Find corresponding captions
        const imageData = captions.find(item => item.url.includes(selectedPath));
        if (!imageData) return;

        // Select two random captions
        const availableCaptions = [...imageData.captions];
        if (availableCaptions.length < 2) return;

        // Shuffle array and take first two
        for (let i = availableCaptions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableCaptions[i], availableCaptions[j]] = 
            [availableCaptions[j], availableCaptions[i]];
        }

        const [first, second] = availableCaptions;

        setCurrentImage(selectedPath);
        setCaptionA(first.text);
        setCaptionB(second.text);
        setModelA(first.model);
        setModelB(second.model);
        setRotation(0);  // Reset rotation when changing images

        setRotation(0);
        // Reset position
        if (transformComponentRef.current) {
            transformComponentRef.current.resetTransform();
        }

    };

    useEffect(() => {
        // Check if auth cookie exists
        const checkAuth = async () => {
            try {
                console.log('Checking auth...');
                const response = await fetch(`${returnDomain('api')}/api/stats`, {
                    credentials: 'include'  // Make sure we're sending cookies
                });
                console.log('Auth response status:', response.status);
                if (response.ok) {
                    setIsLoggedIn(true);
                    console.log('Auth successful');
                } else {
                    console.log('Auth failed');
                    setIsLoggedIn(false);
                }
            } catch (error) {
                console.error('Auth check error:', error);
                setIsLoggedIn(false);
            }
        };
        checkAuth();
    }, []);

    useEffect(() => {
        selectRandomImageAndCaptions();
    }, []);

    const fetchStats = async () => {
        try {
            const response = await fetch(`${returnDomain('api')}/api/stats`);
            const data = await response.json();
            console.log('Database contents:', data);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const submitJudgment = async (selectedModel, otherModel) => {
        try {
            const response = await fetch(`${returnDomain('api')}/api/submit_judgment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    imgPath: currentImage,
                    selectedModel: selectedModel,
                    otherModel: otherModel
                })
            });
    
            if (response.ok) {
                selectRandomImageAndCaptions();
            }
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const handleRotate = (direction) => {
        setRotation(prev => (prev + (direction === 'right' ? 90 : -90)) % 360);
    };

    if (!currentImage || !captionA || !captionB) {
        return <div>Loading...</div>;
    }

    if (!isLoggedIn) {
        return <Login onLogin={setIsLoggedIn} />;
    }

    return (
        <div className="app-container">
            {showInstructions && (
                <Instructions onClose={() => setShowInstructions(false)} />
            )}
            <div id="controls">
                <button onClick={fetchStats}>STATS</button>
                <button className='rotate-button' onClick={() => handleRotate('left')}>⟲</button>
                <button className='rotate-button' onClick={() => handleRotate('right')}>⟳</button>
                <div id="imgpath">{currentImage.slice(0, -4)}</div>
            </div>
    
            <div className="image-container">
            <TransformWrapper
                ref={transformComponentRef}
                initialScale={1}
                minScale={0.5}
                maxScale={4}
                wheel={{ step: 0.1 }}
                centerOnInit={false}
                limitToBounds={false}  // This should prevent the bounce-back
                boundsSensitivity={0}  // Makes the bounds less "magnetic"
            >
                <TransformComponent
                    wrapperClass="transform-component-holder"
                >
                    <img 
                        src={returnDomain('image') + 'img/' + currentImage} 
                        alt="Random"
                        style={{
                            transform: `rotate(${rotation}deg)`,
                            transition: 'transform 0.3s ease'
                        }}
                    />
                </TransformComponent>
            </TransformWrapper>
            </div>
    
            <div id="captions">
                <div 
                    className="caption-box" 
                    onClick={() => submitJudgment(modelA, modelB)}
                >
                    {captionA}
                </div>
                <div 
                    className="caption-box"
                    onClick={() => submitJudgment(modelB, modelA)}
                >
                    {captionB}
                </div>
            </div>
        </div>
    );
}