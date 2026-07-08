(function () {
  const progressValue = document.getElementById("progressValue");
  const modalProgressValue = document.getElementById("modalProgressValue");
  const modalProgressBar = document.getElementById("modalProgressBar");
  const uninstallButton = document.getElementById("uninstallButton");
  const uninstallModal = document.getElementById("uninstallModal");
  const modalStayButton = document.getElementById("modalStayButton");
  const modalUninstallButton = document.getElementById("modalUninstallButton");
  const cards = Array.from(document.querySelectorAll("[data-feature-card]"));
  const tickIcon = "../../shared/assets/figma-mini-app/tick-circle-green.svg";
  const spinnerIcon = "../../shared/assets/figma-mini-app/loading-spinner.svg";
  const fastForwardMilestones = [20, 40, 65, 90];
  let progress = 0;

  function setCardState(card, state) {
    const stateIcon = card.querySelector(".feature-state");

    stateIcon.classList.toggle("spinner", state === "loading");
    stateIcon.classList.toggle("is-pending", state === "pending");

    if (state === "done") {
      stateIcon.src = tickIcon;
    } else if (state === "loading") {
      stateIcon.src = spinnerIcon;
    } else {
      stateIcon.removeAttribute("src");
    }
  }

  function renderProgress() {
    progressValue.textContent = `${progress}%`;
    modalProgressValue.textContent = `${progress}%`;
    modalProgressBar.style.width = `${progress}%`;

    cards.forEach((card, index) => {
      const start = index * 25;
      const end = start + 25;
      let state = "pending";

      if (progress >= end) {
        state = "done";
      } else if (progress >= start) {
        state = "loading";
      }

      setCardState(card, state);
    });
  }

  function openUninstallModal() {
    if (progress === 100) return;
    uninstallModal.hidden = false;
  }

  function closeUninstallModal() {
    uninstallModal.hidden = true;
  }

  function setProgress(nextProgress) {
    progress = Math.max(0, Math.min(100, Math.round(nextProgress)));
    renderProgress();
  }

  function fastForward() {
    const nextMilestone = fastForwardMilestones.find((milestone) => milestone > progress);

    if (typeof nextMilestone === "number") {
      setProgress(nextMilestone);
    }
  }

  renderProgress();

  uninstallButton.addEventListener("click", openUninstallModal);
  modalStayButton.addEventListener("click", closeUninstallModal);
  modalUninstallButton.addEventListener("click", closeUninstallModal);

  window.setInterval(() => {
    setProgress(progress + 1);
  }, 1000);

  window.__miniAppProgress = {
    fastForward,
    getProgress() {
      return progress;
    },
    setProgress,
  };
})();
