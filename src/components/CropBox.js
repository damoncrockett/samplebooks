import React, { useState, useEffect, useRef } from 'react';

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
            width: Math.max(0.05, Math.min(1, pixelWidth / displayWidth)),
            height: Math.max(0.05, Math.min(1, pixelHeight / displayHeight))
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

export default CropBox;