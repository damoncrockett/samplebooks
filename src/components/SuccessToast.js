import React from 'react';

const SuccessToast = ({ show }) => {
  return (
    <div className={`success-toast ${show ? 'show' : ''}`}>
      ✅
    </div>
  );
};

export default SuccessToast;