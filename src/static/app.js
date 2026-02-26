document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      // Reset activity select so we don't duplicate options on refresh
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        // build participants section (always shown) with remove buttons
        let participantsMarkup = `
          <div class="participants-section">
            <p><strong>Participants:</strong></p>
            ${details.participants && details.participants.length > 0
              ? `<ul class="participant-list">${details.participants
                  .map((p) =>
                    `<li class="participant-item"><span class="participant-name">${p}</span><button class="remove-btn" data-activity="${name}" data-email="${p}" aria-label="Remove ${p}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="14" height="14">
                          <path fill="currentColor" d="M3 6h18v2H3V6zm2 3h14l-1 12H6L5 9zm3-6h8l1 2H7L8 3z"/>
                        </svg>
                      </button></li>`
                  )
                  .join("")}</ul>`
              : `<p class="no-participants">No participants yet</p>`}
          </div>
        `;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          ${participantsMarkup}
        `;

        activitiesList.appendChild(activityCard);

        // attach delete handlers for participant remove buttons
        activityCard.querySelectorAll(".remove-btn").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            const email = btn.dataset.email;
            const activity = btn.dataset.activity;

            if (!email || !activity) return;

            try {
              const res = await fetch(
                `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
                { method: "POST" }
              );

              const result = await res.json();
              if (res.ok) {
                // refresh the list to reflect changes
                fetchActivities();
              } else {
                console.error("Unregister failed:", result.detail || result.message);
              }
            } catch (err) {
              console.error("Error unregistering participant:", err);
            }
          });
        });

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Helper to create a participant list item element
  function createParticipantListItem(name, activity) {
    const li = document.createElement("li");
    li.className = "participant-item";

    const span = document.createElement("span");
    span.className = "participant-name";
    span.textContent = name;

    const btn = document.createElement("button");
    btn.className = "remove-btn";
    btn.setAttribute("data-activity", activity);
    btn.setAttribute("data-email", name);
    btn.setAttribute("aria-label", `Remove ${name}`);
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="14" height="14">
        <path fill="currentColor" d="M3 6h18v2H3V6zm2 3h14l-1 12H6L5 9zm3-6h8l1 2H7L8 3z"/>
      </svg>`;

    btn.addEventListener("click", async () => {
      try {
        const res = await fetch(
          `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(name)}`,
          { method: "POST" }
        );
        if (res.ok) {
          // remove from DOM
          li.remove();
          // update availability text if present
          const card = btn.closest(".activity-card");
          if (card) {
            const availP = Array.from(card.querySelectorAll("p")).find((p) => p.textContent.includes("Availability:"));
            if (availP) {
              const match = availP.textContent.match(/(\d+) spots left$/);
              if (match) {
                const current = parseInt(match[1], 10);
                availP.innerHTML = `<strong>Availability:</strong> ${current + 1} spots left`;
              }
            }
          }
        } else {
          const result = await res.json();
          console.error("Unregister failed:", result.detail || result.message);
        }
      } catch (err) {
        console.error("Error unregistering participant:", err);
      }
    });

    li.appendChild(span);
    li.appendChild(btn);
    return li;
  }

  // Add a newly signed-up participant to the DOM without refetching
  function addParticipantToActivityDOM(activityName, email) {
    // Find the activity card by matching its h4 text
    const cards = activitiesList.querySelectorAll(".activity-card");
    for (const card of cards) {
      const title = card.querySelector("h4");
      if (title && title.textContent === activityName) {
        const participantsSection = card.querySelector(".participants-section");
        if (!participantsSection) return;

        let ul = participantsSection.querySelector(".participant-list");
        const noPart = participantsSection.querySelector(".no-participants");
        if (noPart) {
          noPart.remove();
        }

        if (!ul) {
          ul = document.createElement("ul");
          ul.className = "participant-list";
          participantsSection.appendChild(ul);
        }

        const li = createParticipantListItem(email, activityName);
        ul.appendChild(li);

        // update availability
        const availP = Array.from(card.querySelectorAll("p")).find((p) => p.textContent.includes("Availability:"));
        if (availP) {
          const match = availP.textContent.match(/(\d+) spots left$/);
          if (match) {
            const current = parseInt(match[1], 10);
            availP.innerHTML = `<strong>Availability:</strong> ${Math.max(0, current - 1)} spots left`;
          }
        }
        break;
      }
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();
        // update the DOM immediately so users don't need to refresh
        addParticipantToActivityDOM(activity, email);
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  fetchActivities();
});
