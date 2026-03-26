import React, { useEffect } from 'react';
import './Back_To_Top_Button.css';
import $ from 'jquery';

function Back_To_Top_Button() {
  useEffect(() => {
    const progressPath = document.querySelector('.progress-wrap path');
    const pathLength = progressPath.getTotalLength();

    // Set up the progress path
    progressPath.style.transition = progressPath.style.WebkitTransition = 'none';
    progressPath.style.strokeDasharray = `${pathLength} ${pathLength}`;
    progressPath.style.strokeDashoffset = pathLength;
    progressPath.getBoundingClientRect();
    progressPath.style.transition = progressPath.style.WebkitTransition = 'stroke-dashoffset 10ms linear';

    const updateProgress = () => {
      const scroll = $(window).scrollTop();
      const height = $(document).height() - $(window).height();
      const progress = pathLength - (scroll * pathLength) / height;
      progressPath.style.strokeDashoffset = progress;
    };

    updateProgress();
    $(window).on('scroll', updateProgress);

    const offset = 50;
    const duration = 550;

    $(window).on('scroll', () => {
      if ($(window).scrollTop() > offset) {
        $('.progress-wrap').addClass('active-progress');
      } else {
        $('.progress-wrap').removeClass('active-progress');
      }
    });

    $('.progress-wrap').on('click', (event) => {
      event.preventDefault();
      $('html, body').animate({ scrollTop: 0 }, duration);
      return false;
    });

    return () => {
      $(window).off('scroll', updateProgress);
      $('.progress-wrap').off('click');
    };
  }, []);

  return (
    <div className="progress-wrap">
      <svg className="progress-circle svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
        <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
      </svg>
    </div>
  );
}

export default Back_To_Top_Button;
