import { theme } from "../../../theme";

const index = () => {
  return (
    <box width="100%" alignItems="center">
      <box width="100%">
        <box flexDirection="row" paddingBottom={0.5} paddingX={2}>
          <text fg={theme.inputBar.thinking}>Thinking</text>
          <text marginX={1}>*</text>
          <text>Opus 4.6</text>
        </box>
        <box width="100%" borderColor="#fff" border={["top", "bottom"]}>
          <box paddingX={3} paddingY={1} width="100%" gap={0.5}>
            <box position="relative" justifyContent="center">
              <box flexDirection="row" gap={2}>
                <text>&gt;</text>
                <textarea
                  placeholder={`Try "Analyze this codebase"`}
                  width="100%"
                />

              </box>
            </box>
          </box>
        </box>
      </box>
    </box>
  );
};

export default index;
