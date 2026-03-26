import React, { useEffect, useRef, useState } from 'react';
import { IoMdRefresh } from "react-icons/io";

const VisualCaptcha = ({ onValidationChange }) => {
  const canvasRef = useRef(null);
  const [captchaText, setCaptchaText] = useState('');
  const [userInput, setUserInput] = useState('');
  const [isValid, setIsValid] = useState(null);

  const generateCaptcha = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Generate random captcha text
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let text = '';
    for (let i = 0; i < 4; i++) {
      text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptchaText(text);
    setUserInput('');
    setIsValid(null);
    onValidationChange(false);

    // Clear canvas
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);

    // Draw text with effects
    text.split('').forEach((char, i) => {
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = `rgb(${Math.random() * 100}, ${Math.random() * 100}, ${Math.random() * 100})`;
      
      // Random rotation
      const rotation = (Math.random() - 0.5) * 0.4;
      ctx.translate(30 + i * 25, 30);
      ctx.rotate(rotation);
      
      // Add distortion
      const shearAmount = (Math.random() - 0.5) * 0.5;
      ctx.transform(1, shearAmount, 0, 1, 0, 0);
      
      ctx.fillText(char, 0, 0);
      
      // Reset transformation
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    });

    // Add interference lines
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.5)`;
      ctx.lineWidth = 1;
      ctx.moveTo(Math.random() * width, Math.random() * height);
      ctx.bezierCurveTo(
        Math.random() * width, Math.random() * height,
        Math.random() * width, Math.random() * height,
        Math.random() * width, Math.random() * height
      );
      ctx.stroke();
    }

    // Add noise dots
    for (let i = 0; i < 100; i++) {
      ctx.fillStyle = `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.5)`;
      ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
    }
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  // Auto-validate when input length reaches 4
  useEffect(() => {
    if (userInput.length === 4) {
      const isCorrect = userInput === captchaText;
      setIsValid(isCorrect);
      onValidationChange(isCorrect);
      if (!isCorrect) {
        // Add delay before resetting
        setTimeout(() => {
          generateCaptcha();
          setUserInput('');
        }, 1500); // Show error message for 1.5 seconds
      }
    }
  }, [userInput, captchaText, onValidationChange]);

  return (
    <div className="w-full max-w-md mx-auto">
      <h3 className="text-[15px] text-[hsl(0,0%,0%)] font-poppins font-normal mb-[2%]">
        Verification Code
      </h3>

      <div className="bg-white rounded-lg p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between space-x-4">
            <canvas 
              ref={canvasRef} 
              width="140" 
              height="40" 
              className="border rounded bg-gray-100 ml-2 p-1"
            />
              <IoMdRefresh className="text-[#bfbfbf] text-2xl cursor-pointer" onClick={generateCaptcha} />
          </div>
          
          <div className="flex gap-2 border rounded-lg p-2 bg-white">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Enter code above"
              maxLength={4}
              className="flex-1 px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-blue-500 outline-none"
              required
            />
          </div>
          
          {isValid !== null && (
            <div className={`text-sm ${isValid ? 'text-green-600' : 'text-red-600'}`}>
              {isValid ? 'Verification successful!' : 'Incorrect code, please try again'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VisualCaptcha;