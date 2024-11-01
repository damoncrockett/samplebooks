import React, { useState } from 'react';
import { returnDomain } from './App';  // make sure path is correct

export default function Login({ onLogin }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            console.log('Attempting login to:', `${returnDomain('api')}/api/login`); // Debug log
            const response = await fetch(`${returnDomain('api')}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password }),
                credentials: 'include'
            });

            console.log('Response status:', response.status); // Debug log

            if (response.ok) {
                onLogin(true);
                setError('');
            } else {
                setError('Invalid password');
            }
        } catch (err) {
            console.error('Login error:', err); // Debug log
            setError('Connection error');
        }
    };

    return (
        <div className="login-container">
            <form onSubmit={handleSubmit} className="login-form">
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="password-input"
                />
                <button type="submit">LOGIN</button>
                {error && <div className="error-message">{error}</div>}
            </form>
        </div>
    );
}