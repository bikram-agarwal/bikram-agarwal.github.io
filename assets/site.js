(() => {
  const screenshotButtons = Array.from(document.querySelectorAll("[data-screenshot-src]"));

  if (!screenshotButtons.length) {
    return;
  }

  const dialog = document.createElement("dialog");
  dialog.className = "image-dialog";
  dialog.setAttribute("aria-label", "Expanded screenshot");
  dialog.setAttribute("tabindex", "-1");
  dialog.innerHTML = `
    <div class="image-dialog-inner">
      <img class="dialog-image" alt="">
      <p class="dialog-caption"></p>
    </div>
  `;
  document.body.append(dialog);

  const dialogImage = dialog.querySelector(".dialog-image");
  const dialogCaption = dialog.querySelector(".dialog-caption");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let activeButton = null;
  let activeThumbnail = null;
  let activeIndex = -1;
  let lastInputWasKeyboard = false;
  let restoreFocusOnClose = false;
  let screenshotSwapTimer = null;

  const withTransition = (updatePage) => {
    if (!document.startViewTransition || reducedMotion.matches) {
      updatePage();
      return Promise.resolve();
    }

    return document.startViewTransition(updatePage).finished.catch(() => {});
  };

  const clearTransitionNames = () => {
    if (activeThumbnail) {
      activeThumbnail.style.viewTransitionName = "";
    }

    dialogImage.style.viewTransitionName = "";
  };

  const updateDialogImage = (button) => {
    const thumbnailImage = button.querySelector("img");
    const caption = button.closest("figure")?.querySelector("figcaption")?.textContent?.trim()
      || button.dataset.screenshotCaption
      || thumbnailImage?.alt
      || "";
    const usesFreeformLayout = thumbnailImage?.classList.contains("freeform-shot") || false;

    dialog.classList.toggle("freeform", usesFreeformLayout);
    dialogImage.src = button.dataset.screenshotSrc;
    dialogImage.alt = caption || "Expanded screenshot";
    dialogCaption.textContent = caption;
  };

  const openScreenshot = (button) => {
    activeButton = button;
    activeThumbnail = button.querySelector("img");
    activeIndex = screenshotButtons.indexOf(button);
    restoreFocusOnClose = lastInputWasKeyboard;

    if (activeThumbnail) {
      activeThumbnail.style.viewTransitionName = "screenshot-morph";
    }

    withTransition(() => {
      updateDialogImage(button);
      dialogImage.style.viewTransitionName = "screenshot-morph";

      if (activeThumbnail) {
        activeThumbnail.style.viewTransitionName = "";
      }

      dialog.showModal();
    }).then(() => dialog.focus());
  };

  const cycleScreenshot = (direction) => {
    if (!dialog.open || !screenshotButtons.length) {
      return;
    }

    const nextIndex = (activeIndex + direction + screenshotButtons.length) % screenshotButtons.length;
    const nextButton = screenshotButtons[nextIndex];

    activeIndex = nextIndex;
    activeButton = nextButton;
    activeThumbnail = nextButton.querySelector("img");

    if (screenshotSwapTimer) {
      window.clearTimeout(screenshotSwapTimer);
    }

    if (reducedMotion.matches) {
      updateDialogImage(nextButton);
      return;
    }

    dialogImage.classList.add("is-switching");
    dialogCaption.classList.add("is-switching");
    screenshotSwapTimer = window.setTimeout(() => {
      updateDialogImage(nextButton);
      window.requestAnimationFrame(() => {
        dialogImage.classList.remove("is-switching");
        dialogCaption.classList.remove("is-switching");
      });
      screenshotSwapTimer = null;
    }, 140);
  };

  const closeScreenshot = (shouldRestoreFocus = restoreFocusOnClose) => {
    if (!dialog.open) {
      return;
    }

    if (screenshotSwapTimer) {
      window.clearTimeout(screenshotSwapTimer);
      screenshotSwapTimer = null;
    }

    dialogImage.classList.remove("is-switching");
    dialogCaption.classList.remove("is-switching");

    withTransition(() => {
      if (activeThumbnail) {
        activeThumbnail.style.viewTransitionName = "screenshot-morph";
      }

      dialog.close();
    }).then(() => {
      clearTransitionNames();
      if (shouldRestoreFocus) {
        activeButton?.focus();
      } else {
        activeButton?.blur();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }

      activeButton = null;
      activeThumbnail = null;
      activeIndex = -1;
      restoreFocusOnClose = false;
    });
  };

  window.addEventListener("keydown", (event) => {
    lastInputWasKeyboard = true;

    if (!dialog.open) {
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      cycleScreenshot(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      cycleScreenshot(-1);
    }
  });
  window.addEventListener("pointerdown", () => {
    lastInputWasKeyboard = false;
  });

  screenshotButtons.forEach((button) => {
    button.addEventListener("click", () => openScreenshot(button));
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeScreenshot();
    }
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeScreenshot(false);
  });
})();
