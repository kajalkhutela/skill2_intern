/* Resume Upload Handler
 * Manages PDF upload, parsing, and skill extraction
 */

let extractedSkillsData = null;

document.addEventListener('DOMContentLoaded', function() {
  setupResumeUploadHandlers();
 
});

// ===============================
// TAB SWITCHING
// ===============================
function setupTabSwitching() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      
      // Remove active class from all
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to selected
      this.classList.add('active');
      document.getElementById(tabName).classList.add('active');
    });
  });
}

// ===============================
// RESUME UPLOAD HANDLERS
// ===============================
  

  // Drag and drop
  uploadArea.addEventListener('dragover', function(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', function() {
    uploadArea.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', function(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf') {
        handleResumeUpload(file, uploadError, uploadSuccess);
      } else {
        showError(uploadError, '❌ Please upload a PDF file');
      }
    }
  });

  // Setup extracted skills buttons
  const useExtractedBtn = document.getElementById('useExtractedBtn');
  const continueManualBtn = document.getElementById('continueManualBtn');

  if (useExtractedBtn) {
    useExtractedBtn.addEventListener('click', function() {
      if (extractedSkillsData) {
        populateFormWithExtractedSkills(extractedSkillsData);
      }
    });
  }

  if (continueManualBtn) {
    continueManualBtn.addEventListener('click', function() {
      // Switch to manual tab
      document.querySelector('[data-tab="manual"]').click();
      showSuccess(uploadSuccess, '✓ You can now edit and submit manually');
    });
  }

// ===============================
// RESUME UPLOAD PROCESSING