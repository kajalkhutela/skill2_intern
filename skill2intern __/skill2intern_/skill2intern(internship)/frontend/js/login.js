// Handle skills input - add skill on Enter key or selection
document.getElementById('skillsInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    e.preventDefault();  // Prevent form submission
    const skillValue = this.value.trim();  // Get input value and remove whitespace

    if (skillValue && !isSkillAlreadySelected(skillValue)) {
      addSkillTag(skillValue);  // Add the skill as a tag
      this.value = '';  // Clear the input field
      updateProgress();  // Update form progress
    }
  }
});

// Function to check if skill is already selected
function isSkillAlreadySelected(skill) {
  const selectedSkills = document.querySelectorAll('#selectedSkills .skill-tag');
  return Array.from(selectedSkills).some(tag =>
    tag.textContent.replace('×', '').trim().toLowerCase() === skill.toLowerCase()
  );
}

// Function to add skill tag
function addSkillTag(skill) {
  const selectedSkillsContainer = document.getElementById('selectedSkills');
  const skillTag = document.createElement('span');
  skillTag.className = 'skill-tag';
  skillTag.innerHTML = `${skill} <span class="remove-skill" style="cursor: pointer; margin-left: 5px; color: #dc2626;">×</span>`;

  // Add click handler to remove the tag
  skillTag.querySelector('.remove-skill').addEventListener('click', function() {
    skillTag.remove();
    updateProgress();
  });

  selectedSkillsContainer.appendChild(skillTag);
}

// Handle skills selection from datalist
document.getElementById('skillsInput').addEventListener('change', function() {
  const skillValue = this.value.trim();
  if (skillValue && !isSkillAlreadySelected(skillValue)) {
    addSkillTag(skillValue);
    this.value = '';
    updateProgress();
  }
});

// Handle student profile form
document.getElementById("profileForm").addEventListener("submit", function (e) {
  e.preventDefault();

  // Get selected skills from checkboxes (predefined)
  const skillCheckboxes = document.querySelectorAll('input[name="skills"]:checked');
  const checkboxSkills = Array.from(skillCheckboxes).map(cb => cb.value);

  // Get selected skills from the tag-based input (custom)
  const selectedSkills = Array.from(document.querySelectorAll('#selectedSkills .skill-tag'))
    .map(tag => tag.textContent.replace('×', '').trim());

  // Combine all skills
  const skills = [...checkboxSkills, ...selectedSkills];

  // Validate skills selection
  if (skills.length === 0) {
    const errorEl = document.getElementById("skillsError");
    errorEl.innerText = "Please select at least one skill";
    errorEl.classList.add("show");
    return;
  }

  const errorEl = document.getElementById("skillsError");
  errorEl.classList.remove("show");

  const profile = {
    name: document.getElementById("name").value,
    city: document.getElementById("city").value,
    jobType: document.getElementById("jobType").value,
    education: document.getElementById("education").value,
    skills: skills,  // Array of all selected skills
    createdAt: new Date().toISOString()
  };

  // Save to localStorage
  localStorage.setItem("studentProfile", JSON.stringify(profile));

  // Show success state
  const btn = document.querySelector('.submit-btn');
  btn.disabled = true;
  btn.innerText = '✓ Profile Created! Redirecting...';

  // Redirect to dashboard
  setTimeout(() => {
    window.location.href = "dashboard.html";
  }, 1000);
});

// Populate city dropdown from server data
async function populateCityDropdown() {
  try {
    const response = await fetch('/cities');
    const cities = await response.json();
    
    const citySelect = document.getElementById("city");
    cities.forEach(city => {
      const option = document.createElement("option");
      option.value = city;
      option.textContent = city;
      citySelect.appendChild(option);
    });
  } catch (err) {
    console.error('Error loading cities:', err);
  }
}

// Add visual feedback when skills are selected
document.querySelectorAll('.skill-checkbox input[type="checkbox"]').forEach(checkbox => {
  checkbox.addEventListener('change', function() {
    if (this.checked) {
      this.closest('.skill-checkbox').classList.add('selected');
    } else {
      this.closest('.skill-checkbox').classList.remove('selected');
    }
    updateProgress();
  });
});

// Update progress bar based on form completion
function updateProgress() {
  const nameFilled = document.getElementById('name').value.trim() !== '';
  const cityFilled = document.getElementById('city').value.trim() !== '';
  const skillChecked = document.querySelectorAll('input[name="skills"]:checked').length > 0 || document.querySelectorAll('#selectedSkills .skill-tag').length > 0;

  const steps = document.querySelectorAll('.progress-step');
  steps[0].classList.toggle('active', nameFilled);
  steps[1].classList.toggle('active', cityFilled);
  steps[2].classList.toggle('active', skillChecked);
}

// Track input changes for progress
document.getElementById('name').addEventListener('input', updateProgress);
document.getElementById('city').addEventListener('change', updateProgress);
document.getElementById('jobType').addEventListener('change', updateProgress);
document.getElementById('education').addEventListener('change', updateProgress);
// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  populateCityDropdown();
});
