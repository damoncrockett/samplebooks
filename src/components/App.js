import React, { useState } from 'react';
import imgpaths from '../assets/json/imgpaths.json';

export function returnDomain() {
    const production = process.env.NODE_ENV === 'production';
    return production ? '' : 'http://localhost:8888/'
}

export default function App() {
    const [imgPath, setImgPath] = useState(imgpaths[0]);

    return (
        <div>
            <div id='controls'>
                <button
                    id='rand'
                    onClick={() => {
                        const randomIndex = Math.floor(Math.random() * imgpaths.length);
                        setImgPath(imgpaths[randomIndex]);
                    }}
                >
                    RAND
                </button>
                <div id='imgpath'>{imgPath.slice(0,-4)}</div>
            </div>
            <img
                src={returnDomain() + 'img/' + imgPath}
            />
        </div>
    );
}