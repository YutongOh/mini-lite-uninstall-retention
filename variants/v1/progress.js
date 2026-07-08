(function () {
  const progressValue = document.getElementById("progressValue");
  const cards = Array.from(document.querySelectorAll("[data-feature-card]"));
  const tickIcon = "../../shared/assets/figma-mini-app/tick-circle-green-v2.svg";
  const darkTickIcon = "../../shared/assets/figma-mini-app/tick-circle-green-dark.svg";
  const spinnerIcon = "../../shared/assets/figma-mini-app/loading-spinner-v2.svg";
  const fastForwardMilestones = [20, 40, 65, 90];
  let progress = 0;

  function currentTickIcon() {
    return document.documentElement.dataset.theme === "dark" ? darkTickIcon : tickIcon;
  }

  function setCardState(card, state) {
    const stateIcon = card.querySelector(".feature-state");
    const stateButton = card.querySelector(".feature-state-button");

    stateIcon.classList.toggle("is-done", state === "done");
    stateIcon.classList.toggle("spinner", state === "loading");
    stateIcon.classList.toggle("is-pending", state === "pending");
    stateButton.classList.toggle("is-done", state === "done");
    stateButton.classList.toggle("is-loading", state === "loading");
    stateButton.classList.toggle("is-pending", state === "pending");

    if (state === "done") {
      stateIcon.src = currentTickIcon();
    } else if (state === "loading") {
      stateIcon.src = spinnerIcon;
    } else {
      stateIcon.removeAttribute("src");
    }
  }

  function renderProgress() {
    progressValue.textContent = `${progress}%`;

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

  function setProgress(nextProgress) {
    progress = Math.max(0, Math.min(100, nextProgress));
    renderProgress();
  }

  function fastForward() {
    const nextMilestone = fastForwardMilestones.find((milestone) => milestone > progress);

    if (typeof nextMilestone === "number") {
      setProgress(nextMilestone);
    }
  }

  renderProgress();

  new MutationObserver(renderProgress).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  window.setInterval(() => {
    setProgress(progress + 1);
  }, 400);

  window.__miniAppProgress = {
    fastForward,
    getProgress() {
      return progress;
    },
    setProgress,
  };
})();
