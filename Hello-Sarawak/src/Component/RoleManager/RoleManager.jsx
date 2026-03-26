import React from 'react';
import './RoleManager.css';

const RoleManager = ({ isOpen, user, roles, selectedRole, onRoleChange, onSubmit, onClose }) => {
    if (!isOpen || !user) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-container">
                <div className="modal-header">
                    <h2>Assign Role to {user.ufirstname} {user.ulastname}</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    <div className="form-group">
                        <label htmlFor="role" className="role-label">Select Role:</label>
                        <select 
                            id="role" 
                            value={selectedRole} 
                            onChange={onRoleChange}
                            className="role-select"
                        >
                            {roles.map(role => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="modal-footer">
                    <div className="button-group">
                        <button 
                            className="assign-button" 
                            onClick={onSubmit}
                        >
                            Assign Role
                        </button>
                        <button 
                            className="cancel-button" 
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoleManager;