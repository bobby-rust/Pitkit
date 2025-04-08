export function setupWindowControls() {
  let cleanupWindowStateListener: (() => void) | null = null;

  const windowControls = async () => {
    // --- Get Button Elements ---
    // It's slightly more React-idiomatic to use refs, but getElementById works fine
    // especially if the titlebar isn't re-rendered often.
    const minButton = document.getElementById("min-button");
    const maxButton = document.getElementById("max-button");
    const restoreButton = document.getElementById("restore-button");
    const closeButton = document.getElementById("close-button");

    // --- Add Click Listeners ---
    const handleMinimize = () => window.electronAPI.minimizeWindow();
    const handleMaximize = () => window.electronAPI.maximizeWindow(); // Main handles toggle
    const handleRestore = () => window.electronAPI.unmaximizeWindow();
    const handleClose = () => window.electronAPI.closeWindow();

    minButton?.addEventListener("click", handleMinimize);
    maxButton?.addEventListener("click", handleMaximize); // Use this if max button should toggle
    restoreButton?.addEventListener("click", handleRestore); // Use this for the dedicated restore button
    closeButton?.addEventListener("click", handleClose);

    // --- Set Initial State ---
    try {
      const initialState = await window.electronAPI.getInitialWindowState();
    } catch (error) {
      console.error("Failed to get initial window state:", error);
    }

    // --- Return Cleanup Function for useEffect ---
    return () => {
      console.log("Cleaning up window control listeners");
      minButton?.removeEventListener("click", handleMinimize);
      maxButton?.removeEventListener("click", handleMaximize);
      restoreButton?.removeEventListener("click", handleRestore);
      closeButton?.removeEventListener("click", handleClose);
      if (cleanupWindowStateListener) {
        cleanupWindowStateListener();
      }
      // Fallback cleanup just in case
      window.electronAPI.removeAllListeners();
      // Remove class if component unmounts
      document.body.classList.remove("maximized");
    };
  };

  let cleanup: (() => void) | undefined;
  windowControls().then((returnedCleanup: () => void) => {
    cleanup = returnedCleanup;
  });

  // This is the actual cleanup function run by useEffect when the component unmounts
  return () => {
    cleanup?.();
  };
}

export function updateWindowState(state: boolean) {
  let cleanupWindowStateListener: (() => void) | null = null;

  const setupWindowControls = async () => {
    // --- Get Button Elements ---
    // It's slightly more React-idiomatic to use refs, but getElementById works fine
    // especially if the titlebar isn't re-rendered often.
    const minButton = document.getElementById("min-button");
    const maxButton = document.getElementById("max-button");
    const restoreButton = document.getElementById("restore-button");
    const closeButton = document.getElementById("close-button");

    // --- Add Click Listeners ---
    const handleMinimize = () => window.electronAPI.minimizeWindow();
    const handleMaximize = () => window.electronAPI.maximizeWindow(); // Main handles toggle
    const handleRestore = () => window.electronAPI.unmaximizeWindow();
    const handleClose = () => window.electronAPI.closeWindow();

    minButton?.addEventListener("click", handleMinimize);
    maxButton?.addEventListener("click", handleMaximize); // Use this if max button should toggle
    restoreButton?.addEventListener("click", handleRestore); // Use this for the dedicated restore button
    closeButton?.addEventListener("click", handleClose);

    // --- Set Initial State ---
    try {
      const initialState = await window.electronAPI.getInitialWindowState();
      updateWindowState(initialState);
    } catch (error) {
      console.error("Failed to get initial window state:", error);
      updateWindowState(false); // Default state on error
    }

    // --- Listen for State Changes from Main Process ---
    cleanupWindowStateListener =
      window.electronAPI.onWindowStateChange(updateWindowState);

    // --- Return Cleanup Function for useEffect ---
    return () => {
      console.log("Cleaning up window control listeners");
      minButton?.removeEventListener("click", handleMinimize);
      maxButton?.removeEventListener("click", handleMaximize);
      restoreButton?.removeEventListener("click", handleRestore);
      closeButton?.removeEventListener("click", handleClose);
      if (cleanupWindowStateListener) {
        cleanupWindowStateListener();
      }
      // Fallback cleanup just in case
      window.electronAPI.removeAllListeners();
      // Remove class if component unmounts
      document.body.classList.remove("maximized");
    };
  };

  let cleanup: (() => void) | undefined;
  setupWindowControls().then((returnedCleanup) => {
    cleanup = returnedCleanup;
  });

  // This is the actual cleanup function run by useEffect when the component unmounts
  return () => {
    cleanup?.();
  };
}
