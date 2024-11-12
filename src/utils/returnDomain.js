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