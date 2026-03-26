import React, { useEffect, useRef } from 'react';
import { FaExclamationCircle } from 'react-icons/fa';
import './Alert.css';

const ConfirmDialog = ({ 
  isOpen, 
  title = 'Are you sure?', 
  message = 'Are you sure you want to proceed with this action?',
  confirmText = 'Yes',
  cancelText = 'Cancel',
  confirmVariant = 'danger',
  icon = <FaExclamationCircle />,
  onConfirm, 
  onCancel 
}) => {
  const dialogRef = useRef(null);
  const confirmButtonRef = useRef(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onCancel]);

  // Focus trap and auto-focus on cancel button
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      confirmButtonRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="confirm-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-message"
    >
      <div className="confirm-dialog" ref={dialogRef}>
        <div className={`confirm-icon ${confirmVariant}`}>
          {icon}
        </div>
        <h2 className="confirm-title" id="dialog-title">
          {title}
        </h2>
        <p className="confirm-message" id="dialog-message">
          {message}
        </p>
        <div className="confirm-buttons">
          <button
            className={`confirm-button ${confirmVariant}`}
            onClick={onConfirm}
            ref={confirmButtonRef}
          >
            {confirmText}
          </button>
          <button
            className="confirm-button cancel"
            onClick={onCancel}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;