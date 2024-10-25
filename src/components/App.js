import React, { useState } from 'react';
import imgpaths from '../assets/json/imgpaths.json';

export function returnDomain(type) {
    const production = process.env.NODE_ENV === 'production';
    if (production) {
        return '';  // No port in production
    }
    
    // For images, we still need the full domain since they're served from a different port
    if (type === 'image') {
        return 'http://localhost:8888/';
    } else if (type === 'api') {
        return 'http://localhost:3001';
    }
    return '';
}

export default function App() {
    const [imgPath, setImgPath] = useState(imgpaths[0]);

    const fetchStats = async () => {
        try {
            const response = await fetch(`${returnDomain('api')}/api/stats`);
            const data = await response.json();
            console.log('Database contents:', data);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const submitJudgment = async (caption) => {
        try {
            const response = await fetch(`${returnDomain('api')}/api/submit_judgment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    imgPath: imgPath,
                    selectedCaption: caption,
                })
            });
    
            if (response.ok) {
                const randomIndex = Math.floor(Math.random() * imgpaths.length);
                setImgPath(imgpaths[randomIndex]);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    };

    return (
        <div>
            <div id="controls">
                <button id="stats" onClick={fetchStats}>STATS</button>
                <div id="imgpath">{imgPath.slice(0, -4)}</div>
            </div>

            <img src={returnDomain('image') + 'img/' + imgPath} alt="Random" />

            <div id="captions">
                <div 
                    className="caption-box" 
                    onClick={() => submitJudgment('Caption A')}
                >
                    In this striking image, a serene mountain lake reflects the surrounding peaks, 
                    while early morning mist creates a ethereal atmosphere. The composition draws 
                    the viewer's eye from the rocky foreground to the distant mountains, creating 
                    a sense of depth and scale. (Model A)
                </div>
                <div 
                    className="caption-box"
                    onClick={() => submitJudgment('Caption B')}
                >
                    The photograph captures a tranquil mountain scene where still waters mirror 
                    the majestic peaks above. Wisps of morning fog add an element of mystery, 
                    while the careful framing emphasizes the grandeur of the natural landscape 
                    through its use of foreground elements. (Model B)
                </div>
            </div>
        </div>
    );
}