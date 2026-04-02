// LOAD STUDENT PROFILE
// ===============================
const profile = JSON.parse(localStorage.getItem("studentProfile") || "null");
// Allow dashboard to load even without profile for demo purposes

// Display user's name in welcome message
if (profile && profile.name) {
  document.getElementById("userName").innerText = profile.name;
}

// Update profile dropdown
if (profile && profile.name) {
  document.getElementById("profileName").innerText = profile.name;
  document.getElementById("profileAvatar").innerText = profile.name.charAt(0).toUpperCase();
}

let currentBestMatch = null;
let cityChart = null;
let stipendChart = null;
let skillsChart = null;
let allCities = [];
let allInternships = [];
let currentModalInternship = null;

// ===============================
// PROFILE DROPDOWN & LOGOUT
// ===============================
document.getElementById("profileMenu")?.addEventListener("click", function(e) {
  const menu = document.getElementById("dropdownMenu");
  menu.style.display = menu.style.display === "none" ? "block" : "none";
  e.stopPropagation();
});

// Close dropdown when clicking outside
document.addEventListener("click", function() {
  const menu = document.getElementById("dropdownMenu");
  if (menu) menu.style.display = "none";
});

document.getElementById("logoutBtn")?.addEventListener("click", function() {
  localStorage.removeItem("studentProfile");
  window.location.href = "login.html";
});

document.getElementById("viewProfileBtn")?.addEventListener("click", function() {
  window.location.href = "profile.html";
});

document.getElementById("settingsBtn")?.addEventListener("click", function() {
  alert("Settings page coming soon!");
});

// ===============================
// SEARCH BAR
// ===============================
const searchInput = document.createElement("input");
searchInput.id = "searchInput";
searchInput.type = "text";
searchInput.placeholder = "🔍 Search by company or job title...";
searchInput.style = "width: 100%; padding: 12px 16px; border: 1.5px solid #ddd; border-radius: 8px; font-size: 14px; margin-bottom: 15px;";

searchInput.addEventListener("input", function(e) {
  const query = e.target.value.toLowerCase();
  const filtered = allInternships.filter(i => {
    const title = (i.job_title || "").toLowerCase();
    const company = (i.company_name || "").toLowerCase();
    return title.includes(query) || company.includes(query);
  });
  renderInternships(filtered);
});

// ===============================
// ADVANCED FILTERS
// ===============================
const advancedFilterBtn = document.createElement("button");
advancedFilterBtn.textContent = "⚙️ Advanced Filters";
advancedFilterBtn.style = "padding: 12px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.3s ease;";
advancedFilterBtn.addEventListener("click", function() {
  document.getElementById("filterModal").style.display = "flex";
});

window.closeFilterModal = function() {
  document.getElementById("filterModal").style.display = "none";
};

window.resetFilters = function() {
  document.getElementById("stipendRange").value = "0";
  document.getElementById("stipendValue").innerText = "₹0/month";
  document.getElementById("durationFilter").value = "";
  loadInternships();
};

window.applyAdvancedFilters = function() {
  const minStipend = parseInt(document.getElementById("stipendRange").value);
  const duration = document.getElementById("durationFilter").value;
  
  const filtered = allInternships.filter(i => {
    const stipend = i.stipend || 0;
    const durationMatch = !duration || (i.duration || "").includes(duration);
    return stipend >= minStipend && durationMatch;
  });
  
  renderInternships(filtered);
  window.closeFilterModal();
};

// Update stipend display
function setupStipendRange() {
  const stipendRange = document.getElementById("stipendRange");
  if (stipendRange) {
    stipendRange.addEventListener("input", function() {
      const val = parseInt(this.value);
      document.getElementById("stipendValue").innerText = "₹" + val.toLocaleString() + "/month";
    });
  }
}

// ===============================
// INTERNSHIP DETAILS MODAL
// ===============================
window.openInternshipModal = function(internship) {
  const modal = document.getElementById("internshipModal");
  document.getElementById("modalTitle").innerText = internship.job_title || "Job";
  document.getElementById("modalCompany").innerText = internship.company_name || "Company";
  
  let html = `
    <div style="margin-bottom: 16px;"><strong style="color: #667eea;">Overview</strong></div>
    <div style="display: flex; margin-bottom: 12px; gap: 12px;">
      <span style="font-weight: 600; color: #667eea; min-width: 120px; font-size: 13px;">City:</span>
      <span style="color: #333; font-size: 13px;">${internship.city || 'N/A'}</span>
    </div>
    <div style="display: flex; margin-bottom: 12px; gap: 12px;">
      <span style="font-weight: 600; color: #667eea; min-width: 120px; font-size: 13px;">Stipend:</span>
      <span style="color: #333; font-size: 13px;">${internship.stipend ? '₹' + internship.stipend.toLocaleString() : 'Unpaid'}</span>
    </div>
    <div style="display: flex; margin-bottom: 12px; gap: 12px;">
      <span style="font-weight: 600; color: #667eea; min-width: 120px; font-size: 13px;">Duration:</span>
      <span style="color: #333; font-size: 13px;">${internship.duration || 'N/A'}</span>
    </div>
    <div style="display: flex; margin-bottom: 12px; gap: 12px;">
      <span style="font-weight: 600; color: #667eea; min-width: 120px; font-size: 13px;">Type:</span>
      <span style="color: #333; font-size: 13px;">${internship.job_type || 'N/A'}</span>
    </div>
    ${internship.days_left ? `<div style="display: flex; margin-bottom: 12px; gap: 12px;"><span style="font-weight: 600; color: #667eea; min-width: 120px; font-size: 13px;">Days Left:</span><span style="color: ${internship.days_left <= 3 && internship.days_left > 0 ? '#dc2626' : '#333'}; font-size: 13px;">${internship.days_left} days</span></div>` : ''}
    ${internship.skill_match_score ? `<div style="display: flex; margin-bottom: 12px; gap: 12px;"><span style="font-weight: 600; color: #667eea; min-width: 120px; font-size: 13px;">Match:</span><span style="color: #333; font-size: 13px;">${Math.round(internship.skill_match_score)}%</span></div>` : ''}
  `;

  document.getElementById("modalBody").innerHTML = html;
  currentModalInternship = internship;
  modal.style.display = "flex";
};

window.closeInternshipModal = function() {
  document.getElementById("internshipModal").style.display = "none";
};



window.applyNow = function() {
  if (!currentModalInternship) {
    alert('No internship selected');
    return;
  }

  // If internship provides an external apply link, open it.
  if (currentModalInternship.apply_link) {
    window.open(currentModalInternship.apply_link, '_blank');
    return;
  }

  // Otherwise perform a no-resume one-click apply: save application record locally
  const profile = JSON.parse(localStorage.getItem('studentProfile') || 'null');
  if (!profile) {
    alert('Please login first.');
    return;
  }

  const projects = JSON.parse(localStorage.getItem('projects') || '[]');
  const attached = JSON.parse(localStorage.getItem('attached_projects') || '[]');
  const applications = JSON.parse(localStorage.getItem('applications') || '[]');

  const app = {
    internship: {
      job_title: currentModalInternship.job_title,
      company_name: currentModalInternship.company_name,
      city: currentModalInternship.city,
      job_type: currentModalInternship.job_type || null
    },
    applicant: {
      name: profile.name,
      city: profile.city,
      education: profile.education,
      skills: profile.skills || [],
      projects: (attached && attached.length ? projects.filter((p,idx)=> attached.includes(idx)).slice(0,3) : projects.slice(0,3)) // attach selected projects if any
    },
    appliedAt: new Date().toISOString()
  };

  applications.unshift(app);
  // Try POSTing to backend; fallback to localStorage if network fails
  fetch('/api/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(app)
  }).then(r => {
    if (r.ok) {
      alert('Applied successfully (no resume). Application sent to server.');
    } else {
      localStorage.setItem('applications', JSON.stringify(applications));
      alert('Applied locally (offline).');
    }
  }).catch(err => {
    localStorage.setItem('applications', JSON.stringify(applications));
    alert('Applied locally (offline).');
  });
};

// ===============================
// LOAD INTERNSHIPS FROM BACKEND
// ===============================
async function loadInternships() {
  try {
    const city = document.getElementById("filterCity")?.value || "";
    const stipend = document.getElementById("filterStipend")?.value || "";
    const duration = document.getElementById("filterDuration")?.value || "";
    const jobType = document.getElementById("filterJobType")?.value || "";

    const skills = profile.skills && profile.skills.length > 0 ? profile.skills.join(",") : "";

    const url = new URL(window.location.origin + "/internships");
    if (city) url.searchParams.append("city", city);
    if (skills) url.searchParams.append("skills", skills);
    if (stipend) url.searchParams.append("stipend", stipend);
    if (duration) url.searchParams.append("duration", duration);
    if (jobType) url.searchParams.append("job_type", jobType);

    const resp = await fetch(url.toString());
    if (!resp.ok) throw new Error('Failed to fetch internships');
    let internships = await resp.json();

    // Backend already filters by job-type, so no need to filter again on frontend

    if (!internships || internships.length === 0) {
      const listEl = document.getElementById("internshipList");
      if (listEl) listEl.innerHTML = '<div style="text-align:center;padding:40px;background:#fff;border-radius:12px;">\n<p style="color:#666">No internships found matching your job type and skills. Try adjusting filters.</p>\n</div>';
      return;
    }

    allInternships = internships;

    // Populate cities on first load from server
    if (allCities.length === 0) {
      loadCitiesDropdown();
    }

    renderStats(internships);
    renderBestMatch(internships);
    renderInternships(internships);
    renderCharts(internships);
  } catch (err) {
    console.error('Error loading internships', err);
    const listEl = document.getElementById('internshipList');
    if (listEl) listEl.innerHTML = '<div style="text-align:center;padding:30px;background:white;border-radius:12px;color:#b91c1c;">Could not load internships</div>';
  }
}

// ===============================
// POPULATE CITY DROPDOWN
// ===============================
async function loadCitiesDropdown() {
  try {
    const response = await fetch('/cities');
    const cities = await response.json();
    allCities = cities;
    
    // Populate the advanced filter dropdown
    const filterCitySelect = document.getElementById("filterCity");
    if (filterCitySelect) {
      // Clear existing options except first one
      while (filterCitySelect.options.length > 1) {
        filterCitySelect.remove(1);
      }
      
      // Add new options
      cities.forEach(city => {
        const option = document.createElement("option");
        option.value = city;
        option.textContent = city;
        filterCitySelect.appendChild(option);
      });
    }
  } catch (err) {
    console.error('Error loading cities:', err);
  }
}

// ===============================
// FILTER BY JOB TYPE
// ===============================
function filterByJobType(internships, jobType) {
  if (!jobType || jobType === "") return internships;
  return internships.filter(i => {
    const iJobType = (i.job_type || "").trim();
    return iJobType.toLowerCase() === jobType.toLowerCase();
  });
}

// ===============================
function renderStats(internships) {
  const totalEl = document.getElementById("totalInternships");
  const citiesEl = document.getElementById("totalCities");
  const avgEl = document.getElementById("avgStipend");
  const closingEl = document.getElementById("closingSoon");

  if (totalEl) totalEl.innerText = internships.length;

  const cities = new Set(internships.map(i => i.city));
  if (citiesEl) citiesEl.innerText = cities.size;

  const avg = internships.length ? internships.reduce((s, i) => s + (i.stipend || 0), 0) / internships.length : 0;
  if (avgEl) avgEl.innerText = `₹${Math.round(avg)}`;

  if (closingEl) closingEl.innerText = internships.filter(i => i.days_left && i.days_left > 0 && i.days_left <= 3).length;
}


//filter by skillsinput using job title and company name
function filterBySkillsInput(internships, skillsInput) {  
  if (!skillsInput || skillsInput.trim() === "") return internships;
  const keywords = skillsInput.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
  return internships.filter(i => {
    const title = (i.job_title || "").toLowerCase();
    const company = (i.company_name || "").toLowerCase();
    return keywords.some(k => title.includes(k) || company.includes(k));
  });
}

// ===============================
// BEST MATCH
// ===============================
function renderBestMatch(internships) {
  // Sort by skill match (highest first), prioritizing user's job-type preference, then by stipend
  const best = internships.sort((a, b) => {
    // If user has jobType preference, prioritize matching job types
    if (profile.jobType) {
      const aMatchesJobType = (a.job_type || "").toLowerCase() === profile.jobType.toLowerCase();
      const bMatchesJobType = (b.job_type || "").toLowerCase() === profile.jobType.toLowerCase();
      
      if (aMatchesJobType && !bMatchesJobType) return -1;
      if (!aMatchesJobType && bMatchesJobType) return 1;
    }
    
    // Then sort by skill match (highest first)
    const skillDiff = (b.skill_match_score || 0) - (a.skill_match_score || 0);
    if (skillDiff !== 0) return skillDiff;
    
    // Finally sort by stipend (highest first)
    return (b.stipend || 0) - (a.stipend || 0);
  })[0];
  
  currentBestMatch = best;

  const cardEl = document.getElementById("bestMatchCard");
  if (!cardEl || !best) return;

  const matchPercentage = Math.round(best.skill_match_score || 0);
  const matchEmoji = matchPercentage >= 80 ? "🔥" : matchPercentage >= 60 ? "⭐" : "👍";
  const daysLeftColor = (best.days_left != null && best.days_left <= 3) ? '#dc2626' : '#666';
  const daysLeftHtml = (best.days_left != null) ? '<p style="font-size: 12px; color: ' + daysLeftColor + ';">⏳ ' + best.days_left + ' days left</p>' : '';
  const jobTypeTag = best.job_type ? `<p style="font-size: 11px; background: #667eea; color: white; display: inline-block; padding: 2px 8px; border-radius: 4px;">💼 ${best.job_type}</p>` : '';
  const skillsTag = (skills) => {
    if (!skills) return '';
    return `<p style="font-size: 11px; background: #10b981; color: white; display: inline-block; padding: 2px 8px; border-radius: 4px; margin-left: 8px;">🛠️ ${skills}</p>`;
  };
  cardEl.innerHTML =
    '<div style="display: flex; justify-content: space-between; align-items: start;">' +
      '<div>' +
        '<h4>' + (best.job_title || '') + '</h4>' +
        '<p><strong>' + (best.company_name || '') + '</strong></p>' +
        jobTypeTag + skillsTag(best.skills_required) +
        '<p>📍 ' + (best.city || '') + '</p>' +
        '<p>💰 ₹' + ((best.stipend) ? (best.stipend).toLocaleString() : "Not specified") + ' | ⏱️ ' + (best.duration || "N/A") + '</p>' +
        daysLeftHtml +
      '</div>' +
      '<div style="text-align: center;">' +
        '<div style="font-size: 48px;">' + matchEmoji + '</div>' +
        '<div style="font-size: 20px; font-weight: bold; color: #4f46e5;">' + matchPercentage + '%</div>' +
        '<div style="font-size: 12px; color: #666;">Match</div>' +
      '</div>' +
    '</div>';
}

// ===============================
// INTERNSHIP LIST
// ===============================
function renderInternships(internships) {
  const list = document.getElementById("internshipList");
  list.innerHTML = "";

  internships.forEach((i, index) => {
    const matchPercentage = Math.round(i.skill_match_score || 0);
    const matchEmoji = matchPercentage >= 80 ? "🔥" : matchPercentage >= 60 ? "⭐" : "👍";
    const matchColor = matchPercentage >= 80 ? "#10b981" : matchPercentage >= 60 ? "#f59e0b" : "#6b7280";

    const daysLeft = i.days_left;
    let urgencyClass = '';
    let daysText = '';

    if (daysLeft !== null) {
        urgencyClass = daysLeft <= 3 ? 'urgent' : '';
        daysText = `⏳ ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
    } else {
        daysText = '❌ Expired';
    }

    const internshipIndex = allInternships.indexOf(i);

    // Job type tag
    const jobTypeTag = i.job_type ? `<span style="display: inline-block; background: #667eea; color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">💼 ${i.job_type}</span>` : '';

    const card = '<div class="intern-card intern-clickable" style="position: relative; cursor: pointer;" data-internship-index="' + internshipIndex + '">' +
      '<div style="padding-right: 30px;">' +
        '<h4 style="margin-bottom: 0;">' + i.job_title + '</h4>' +
        '<p class="company" style="margin-bottom: 8px;">' + i.company_name + jobTypeTag + '</p>' +
        '<div class="details">📍 ' + i.city + '</div>' +
        '<div class="details">⏱️ ' + (i.duration || 'N/A') + '</div>' +
        '<div class="details">💰 ₹' + (i.stipend ? i.stipend.toLocaleString() : 'Not specified') + '/month</div>' +
        (daysText ? '<div class="details" style="color: ' + (daysLeft <= 3 && daysLeft > 0 ? '#dc2626' : '#666') + '">' + daysText + '</div>' : '') +
      '</div>' +
      '<div class="match-badge">' +
        '<span class="match-value">' + matchEmoji + ' <span class="match-percent">' + matchPercentage + '%</span></span>' +
      '</div>' +
    '</div>';

    list.innerHTML += card;
  });

  // Add internship card click handlers (but not on bookmark button)
  document.querySelectorAll('.intern-card').forEach(card => {
    card.addEventListener('click', function(e) {
      const idx = parseInt(this.dataset.internshipIndex);
      const internship = allInternships[idx];
      if (internship) openInternshipModal(internship);
    });
  });

  // (Bookmarks removed) Cards open internship modal on click.
}

// ===============================
// CHARTS
// ===============================
function renderCharts(internships) {
  // CITY CHART
  const cityCount = {};
  internships.forEach(i => {
    cityCount[i.city] = (cityCount[i.city] || 0) + 1;
  });

  if (cityChart) cityChart.destroy();
  const ctx = document.getElementById("cityChart");
  if (ctx) {
    cityChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: Object.keys(cityCount).slice(0, 10),
        datasets: [{
          label: "Internships by City",
          data: Object.values(cityCount).slice(0, 10),
          backgroundColor: "#4f46e5",
          borderColor: "#4338ca",
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } }
      }
    });
  }

  // STIPEND CHART
  const buckets = { "0–5k": 0, "5k–10k": 0, "10k–15k": 0, "15k+": 0 };

  internships.forEach(i => {
    const s = i.stipend || 0;
    if (s < 5000) buckets["0–5k"]++;
    else if (s < 10000) buckets["5k–10k"]++;
    else if (s < 15000) buckets["10k–15k"]++;
    else buckets["15k+"]++;
  });

  if (stipendChart) stipendChart.destroy();
  const stipendCtx = document.getElementById("stipendChart");
  if (stipendCtx) {
    stipendChart = new Chart(stipendCtx, {
      type: "doughnut",
      data: {
        labels: Object.keys(buckets),
        datasets: [{
          label: "Internships",
          data: Object.values(buckets),
          backgroundColor: ["#ef4444", "#f97316", "#eab308", "#22c55e"]
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" } }
      }
    });
  }

  // SKILL MATCH CHART
  const matchBuckets = { "90-100%": 0, "70-89%": 0, "50-69%": 0, "Below 50%": 0 };
  
  internships.forEach(i => {
    const score = i.skill_match_score || 0;
    if (score >= 90) matchBuckets["90-100%"]++;
    else if (score >= 70) matchBuckets["70-89%"]++;
    else if (score >= 50) matchBuckets["50-69%"]++;
    else matchBuckets["Below 50%"]++;
  });

  if (skillsChart) skillsChart.destroy();
  const skillsCtx = document.getElementById("skillsChart");
  if (skillsCtx) {
    skillsChart = new Chart(skillsCtx, {
      type: "bar",
      data: {
        labels: Object.keys(matchBuckets),
        datasets: [{
          label: "Internships by Match Score",
          data: Object.values(matchBuckets),
          backgroundColor: ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"]
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }
}

// ===============================
// AI GUIDANCE
// ===============================
function addBotMessage(text) {
  const chatBox = document.getElementById("chatBox");
  if (chatBox) {
    const msg = document.createElement('div');
    msg.className = 'bot-msg';
    msg.innerHTML = text;
    chatBox.appendChild(msg);
  }
}

function askWhy() {
  if (!currentBestMatch) return;
  const skillsText = profile.skills ? profile.skills.join(", ") : profile.type;
  const message = 'This internship matches your interest in <b>' + skillsText + '</b>, is located in <b>' + currentBestMatch.city + '</b>, and offers a stipend of <b>₹' + currentBestMatch.stipend + '</b>.';
  addBotMessage(message);
}

// ===============================
// PAGE INITIALIZATION - CONSOLIDATED
// ===============================
document.addEventListener("DOMContentLoaded", function() {
  // Setup stipend range slider
  setupStipendRange();

  // Insert search bar and advanced filter button before internship list
  const internshipsSection = document.querySelector(".internships");
  if (internshipsSection) {
    const controlsDiv = document.createElement("div");
    controlsDiv.style = "display: flex; gap: 12px; margin-bottom: 20px; flex-direction: column;";

    // Insert search bar
    controlsDiv.appendChild(searchInput);

    // Insert advanced filter button
    const filterContainer = document.createElement("div");
    filterContainer.style = "display: flex; gap: 12px;";
    filterContainer.appendChild(advancedFilterBtn);

    const resetBtn = document.createElement("button");
    resetBtn.textContent = "🔄 Reset All";
    resetBtn.style = "padding: 12px 20px; background: rgba(150,150,150,0.2); color: #333; border: 1.5px solid #ddd; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.3s ease;";
    resetBtn.addEventListener("click", function() {
      location.reload();
    });
    filterContainer.appendChild(resetBtn);

    controlsDiv.appendChild(filterContainer);

    // Insert after the h3 title
    const h3 = internshipsSection.querySelector("h3");
    if (h3) {
      h3.insertAdjacentElement('afterend', controlsDiv);
    } else {
      internshipsSection.prepend(controlsDiv);
    }
  }

  // Setup filter button event listener
  document.getElementById("applyFilters")?.addEventListener("click", loadInternships);

  // Load internships
  loadInternships();
  // Render left panel projects (commented out in HTML, but keeping for future use)
  // renderLeftProjects();
});

// Left panel projects rendering and attach logic
function renderLeftProjects() {
  const list = document.getElementById('leftProjectsList');
  const lpName = document.getElementById('lpName');
  const lpAvatar = document.getElementById('lpAvatar');
  const lpProjects = document.getElementById('lpProjects');
  const lpApps = document.getElementById('lpApps');
  const profile = JSON.parse(localStorage.getItem('studentProfile') || 'null');
  if (profile) {
    if (lpName) lpName.innerText = profile.name || 'User';
    if (lpAvatar) lpAvatar.innerText = (profile.name||'U').charAt(0).toUpperCase();
  }

  let projects = JSON.parse(localStorage.getItem('projects') || '[]');
  const attached = JSON.parse(localStorage.getItem('attached_projects') || '[]');

  if (lpProjects) lpProjects.innerText = `Projects: ${projects.length}`;
  const applications = JSON.parse(localStorage.getItem('applications') || '[]');
  if (lpApps) lpApps.innerText = `Applied: ${applications.length}`;

  if (!list) return;
  if (!projects || projects.length === 0) {
    list.innerHTML = '<div style="color:#999;font-size:13px">No projects yet. Add from profile.</div>';
    return;
  }
  list.innerHTML = '';
  projects.forEach((p, idx) => {
    const el = document.createElement('div');
    el.className = 'project-card';
    const isAttached = attached.includes(idx);
    el.innerHTML = `<div style="flex:1"><div style="font-weight:600">${p.title}</div><a href="${p.url}" target="_blank">Open</a><div style="font-size:12px;color:#666">${p.description||''}</div></div><div><button data-idx="${idx}" class="attach-btn" style="padding:6px 8px;border-radius:6px;border:none;background:${isAttached? '#4f46e5':'#e6f0ff'};color:${isAttached? 'white':'#333'};cursor:pointer">${isAttached? 'Attached':'Attach'}</button></div>`;
    list.appendChild(el);
  });

  list.querySelectorAll('.attach-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = parseInt(this.dataset.idx);
      let attached = JSON.parse(localStorage.getItem('attached_projects') || '[]');
      if (attached.includes(idx)) {
        attached = attached.filter(i=>i!==idx);
      } else {
        attached.push(idx);
      }
      localStorage.setItem('attached_projects', JSON.stringify(attached));
      renderLeftProjects();
    });
  });

  document.getElementById('lpAddProject')?.addEventListener('click', function(){
    // Jump to profile page to add projects
    window.location.href = 'profile.html';
  });
}

function askSkills() {
  const skillsText = profile.skills ? profile.skills.join(", ") : profile.type;
  const message = 'Focus on core skills, projects, and problem-solving related to ' + skillsText + '. Practical experience matters most.';
  addBotMessage(message);
}

function askApply() {
  addBotMessage('Apply early, tailor your resume, and highlight relevant skills and projects.');
}

// ===============================
// Q&A / FAQ SYSTEM
// ===============================
window.openQAModal = function() {
  if (!currentModalInternship) return;
  
  document.getElementById("internshipModal").style.display = "none";
  document.getElementById("qaModal").style.display = "flex";
  document.getElementById("qaTitle").innerText = `Q&A: ${currentModalInternship.job_title} @ ${currentModalInternship.company_name}`;
  
  loadQAQuestions();
};

window.closeQAModal = function() {
  document.getElementById("qaModal").style.display = "none";
  document.getElementById("internshipModal").style.display = "flex";
};

function getQAKey() {
  if (!currentModalInternship) return null;
  return `qa_${currentModalInternship.company_name}_${currentModalInternship.job_title}`.replace(/\s+/g, '_');
}

function loadQAQuestions() {
  const key = getQAKey();
  if (!key) return;
  
  const qas = JSON.parse(localStorage.getItem(key) || "[]");
  const container = document.getElementById("qaContainer");
  
  if (qas.length === 0) {
    container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No questions yet. Be the first to ask!</p>';
    return;
  }
  
  let html = '';
  qas.forEach((qa, idx) => {
    const date = new Date(qa.timestamp);
    const timeStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    html += `
      <div style="padding: 16px; background: #f8f9fa; border-radius: 8px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
          <div style="font-weight: 600; color: #667eea; font-size: 12px;">❓ ${qa.name}</div>
          <div style="color: #999; font-size: 11px;">${timeStr}</div>
        </div>
        <div style="color: #333; font-size: 13px; margin-bottom: 8px;">${qa.question}</div>
        ${qa.answer ? `<div style="padding: 10px; background: white; border-left: 3px solid #667eea; border-radius: 4px; color: #555; font-size: 12px;"><strong>Answer:</strong> ${qa.answer}</div>` : '<div style="color: #999; font-size: 12px; font-style: italic;">Waiting for answer...</div>'}
      </div>
    `;
  });
  
  container.innerHTML = html;
}

window.submitQuestion = function() {
  const input = document.getElementById("qaInput");
  const question = input.value.trim();

  if (!question || !currentModalInternship || !profile) return;

  const key = getQAKey();
  const qas = JSON.parse(localStorage.getItem(key) || "[]");

  qas.push({
    name: profile.name || 'Anonymous',
    question: question,
    answer: '',
    timestamp: new Date().toISOString()
  });

  localStorage.setItem(key, JSON.stringify(qas));
  input.value = '';
  loadQAQuestions();
};

// ===============================
// CHAT ASSISTANT FUNCTIONS
// ===============================
window.handleChatKeyPress = function(event) {
  if (event.key === 'Enter') {
    sendChatMessage();
  }
};

window.sendChatMessage = async function() {
  const input = document.getElementById("chatInput");
  const question = input.value.trim();

  if (!question) return;

  // Add user message to chat
  addChatMessage(question, 'user');
  input.value = '';

  // Show instant mock response immediately
  const mockResponse = getMockResponse(question);
  addChatMessage(mockResponse, 'bot');

  // Try to get real response from backend and replace if better
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question: question })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.response !== mockResponse) {
        // Replace the mock response with the real one if it's different
        const messages = document.getElementById("chatMessages");
        const lastMessage = messages.lastElementChild;
        if (lastMessage && lastMessage.classList.contains('chat-message') && lastMessage.classList.contains('bot')) {
          lastMessage.textContent = data.response;
        }
      }
    }
  } catch (error) {
    // Keep the instant mock response, no error message needed
    console.log('Backend unavailable, keeping instant response');
  }
};

// Mock AI response generator for instant feedback
function getMockResponse(question) {
  const q = question.toLowerCase();

  // Improvement questions
  if (q.includes('improve') || q.includes('better') || q.includes('skill')) {
    return "To improve your internship prospects, focus on building practical projects and gaining experience in high-demand skills like Python, data analysis, or web development. Consider online courses on Coursera or Udemy, and contribute to open-source projects on GitHub.";
  }

  // Recommendation questions
  if (q.includes('recommend') || q.includes('suggest') || q.includes('best')) {
    return "Based on your profile, I recommend internships in software development or data science. Look for positions that match your skills and location preferences. Companies like Google, Microsoft, and startups often have great opportunities.";
  }

  // Career guidance
  if (q.includes('career') || q.includes('future') || q.includes('path')) {
    return "With your current skills, you have strong potential in technology fields. Consider specializing in areas like AI/ML, full-stack development, or data science. Keep building projects and networking to accelerate your career growth.";
  }

  // Interview questions
  if (q.includes('interview') || q.includes('prepare')) {
    return "For interview preparation, practice common questions about your projects and skills. Be ready to explain your problem-solving approach. Research the company and prepare thoughtful questions for the interviewer.";
  }

  // Application questions
  if (q.includes('apply') || q.includes('application') || q.includes('resume')) {
    return "When applying, tailor your resume to highlight relevant skills and projects. Include a cover letter explaining why you're interested. Apply early and follow up politely if you don't hear back within a week.";

  }

  // Default response
  return "I'm here to help with internship recommendations, skill development advice, and career guidance. Feel free to ask specific questions about improving your profile or finding the right opportunities!";
}

function addChatMessage(message, sender) {
  const messagesContainer = document.getElementById("chatMessages");
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${sender}`;
  messageDiv.style.cssText = `
    margin-bottom: 12px;
    padding: 12px 16px;
    border-radius: 18px;
    max-width: 80%;
    word-wrap: break-word;
    font-size: 14px;
    line-height: 1.4;
  `;

  if (sender === 'user') {
    messageDiv.style.cssText += `
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      margin-left: auto;
      text-align: right;
    `;
  } else {
    messageDiv.style.cssText += `
      background: white;
      color: #333;
      margin-right: auto;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;
  }

  messageDiv.textContent = message;
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTypingIndicator() {
  const messagesContainer = document.getElementById("chatMessages");
  const typingDiv = document.createElement('div');
  typingDiv.id = 'typingIndicator';
  typingDiv.style.cssText = `
    margin-bottom: 12px;
    padding: 12px 16px;
    border-radius: 18px;
    max-width: 80%;
    background: white;
    color: #666;
    margin-right: auto;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  typingDiv.innerHTML = `
    <div style="display: flex; gap: 2px;">
      <div class="dot" style="width: 4px; height: 4px; border-radius: 50%; background: #667eea; animation: bounce 1.4s infinite ease-in-out;"></div>
      <div class="dot" style="width: 4px; height: 4px; border-radius: 50%; background: #667eea; animation: bounce 1.4s infinite ease-in-out 0.2s;"></div>
      <div class="dot" style="width: 4px; height: 4px; border-radius: 50%; background: #667eea; animation: bounce 1.4s infinite ease-in-out 0.4s;"></div>
    </div>
    AI is thinking...
  `;

  // Add CSS animation for dots
  const style = document.createElement('style');
  style.textContent = `
    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
  `;
  document.head.appendChild(style);

  messagesContainer.appendChild(typingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function hideTypingIndicator() {
  const typingDiv = document.getElementById('typingIndicator');
  if (typingDiv) {
    typingDiv.remove();
  }
}


