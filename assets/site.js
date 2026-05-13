(() => {
  const mobileMenus = Array.from(document.querySelectorAll(".mobile-site-menu"));

  if (!mobileMenus.length) {
    return;
  }

  document.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    mobileMenus.forEach((menu) => {
      if (!menu.open) {
        return;
      }

      const clickedSummary = target.closest(".mobile-site-menu > summary");
      const clickedPanel = target.closest(".mobile-menu-panel");
      const clickedLinks = target.closest(".mobile-menu-links");

      if (clickedSummary || clickedLinks) {
        return;
      }

      if (clickedPanel || !menu.contains(target)) {
        menu.open = false;
      }
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    mobileMenus.forEach((menu) => {
      menu.open = false;
    });
  });
})();

(() => {
  const lazyImageSelectors = [
    ".projects-section .card-logo",
    ".archive-mosaic img",
    ".showcase-heading img",
    ".showcase-card > button img",
    ".showcase-media-strip > button img",
    ".screenshot-button img",
  ];
  const lazyImages = Array.from(document.querySelectorAll(lazyImageSelectors.join(", ")));

  lazyImages.forEach((image) => {
    image.setAttribute("loading", "lazy");
    image.setAttribute("decoding", "async");
  });
})();

(() => {
  const screenshotButtonSelectors = [
    ".showcase-card > button",
    ".showcase-media-strip > button",
    ".screenshot-button",
  ];
  const screenshotButtons = Array.from(document.querySelectorAll(screenshotButtonSelectors.join(", ")));

  if (!screenshotButtons.length) {
    return;
  }

  const getScreenshotLabel = (button) => {
    const showcaseCard = button.closest(".showcase-card");
    const showcaseTagline = showcaseCard?.querySelector(".showcase-tagline");
    const showcaseBody = showcaseTagline?.nextElementSibling;
    const showcaseText = [
      showcaseTagline?.textContent?.trim(),
      showcaseBody?.matches("p") ? showcaseBody.textContent.trim() : "",
    ].filter(Boolean).join(" ");

    if (showcaseText) {
      return showcaseText;
    }

    const thumbnailImage = button.querySelector("img");
    return thumbnailImage?.getAttribute("alt")?.trim()
      || button.dataset.screenshotCaption?.trim()
      || "";
  };

  const getScreenshotSrc = (button) => {
    const thumbnailImage = button.querySelector("img");
    return button.dataset.screenshotSrc
      || thumbnailImage?.getAttribute("src")
      || "";
  };

  screenshotButtons.forEach((button) => {
    button.removeAttribute("aria-labelledby");

    const caption = getScreenshotLabel(button);
    const thumbnailImage = button.querySelector("img");
    const figure = button.closest("figure");
    const shouldShowInlineCaption = !button.closest(".compact-media-section");
    let figcaption = figure?.querySelector("figcaption");

    if (caption) {
      button.setAttribute("aria-label", caption);

      if (thumbnailImage && !thumbnailImage.getAttribute("alt")?.trim()) {
        thumbnailImage.setAttribute("alt", caption);
      }
    }

    if (caption && figure && shouldShowInlineCaption && !figcaption) {
      figcaption = document.createElement("figcaption");
      figcaption.setAttribute("aria-hidden", "true");
      figure.append(figcaption);
    }

    if (caption && shouldShowInlineCaption && figcaption) {
      figcaption.textContent = caption;
    }
  });

  const dialog = document.createElement("dialog");
  dialog.className = "image-dialog";
  dialog.setAttribute("aria-label", "Expanded screenshot");
  dialog.setAttribute("tabindex", "-1");
  dialog.innerHTML = `
    <div class="image-dialog-inner">
      <img class="dialog-image" alt="">
      <p class="dialog-caption"></p>
      <a class="pill primary dialog-action" target="_blank" rel="noopener noreferrer" hidden></a>
    </div>
  `;
  document.body.append(dialog);

  const dialogImage = dialog.querySelector(".dialog-image");
  const dialogCaption = dialog.querySelector(".dialog-caption");
  const dialogAction = dialog.querySelector(".dialog-action");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const inlineScreenshotLayout = window.matchMedia("(max-width: 42rem)");
  const siteScript = document.querySelector("script[src*='assets/site.js']");
  const assetsBaseUrl = siteScript ? new URL(".", siteScript.src) : new URL("/assets/", window.location.href);

  dialogAction.innerHTML = `
    <img class="pill-icon" src="${new URL("fav_google-play.ico", assetsBaseUrl).href}" alt="" aria-hidden="true">
    <span></span>
  `;
  const dialogActionText = dialogAction.querySelector("span");

  let activeButton = null;
  let activeThumbnail = null;
  let activeIndex = -1;
  let lastInputWasKeyboard = false;
  let restoreFocusOnClose = false;
  let screenshotSwapTimer = null;

  const syncDialogWidth = () => {
    if (!dialog.open) {
      return;
    }

    const imageWidth = dialogImage.getBoundingClientRect().width;
    if (imageWidth > 0) {
      dialog.style.setProperty("--dialog-media-width", `${Math.ceil(imageWidth)}px`);
    }
  };

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

  const getDialogActionUrl = (button) => {
    return button.dataset.dialogActionUrl
      || button.closest(".showcase-card")?.querySelector(".showcase-action[href]")?.getAttribute("href")
      || "";
  };

  const updateDialogAction = (button) => {
    const actionUrl = getDialogActionUrl(button);

    if (!actionUrl) {
      dialogAction.hidden = true;
      dialogAction.removeAttribute("href");
      return;
    }

    dialogAction.href = actionUrl;
    dialogActionText.textContent = button.dataset.dialogActionLabel
      || "See in Play Store";
    dialogAction.hidden = false;
  };

  const updateDialogImage = (button) => {
    const caption = getScreenshotLabel(button)
      || button.closest("figure")?.querySelector("figcaption")?.textContent?.trim()
      || "";

    dialog.style.removeProperty("--dialog-media-width");
    dialogImage.src = getScreenshotSrc(button);
    dialogImage.alt = caption || "Expanded screenshot";
    dialogCaption.textContent = caption;
    updateDialogAction(button);

    if (dialogImage.complete) {
      window.requestAnimationFrame(syncDialogWidth);
    }
  };

  const openScreenshot = (button) => {
    if (inlineScreenshotLayout.matches) {
      const actionUrl = getDialogActionUrl(button);

      if (actionUrl) {
        window.open(actionUrl, "_blank", "noopener");
      }
      button.blur();
      return;
    }

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
      syncDialogWidth();
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
      dialog.style.removeProperty("--dialog-media-width");
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

  dialogImage.addEventListener("load", () => {
    window.requestAnimationFrame(syncDialogWidth);
  });

  window.addEventListener("resize", () => {
    window.requestAnimationFrame(syncDialogWidth);
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
