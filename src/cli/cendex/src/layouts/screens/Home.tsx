import { useNavigate } from "react-router";
import { theme } from "../../../theme";
import Header from "../../components/Header";
import InputBar from "../../components/InputBar";
import { useModels } from "../../providers/ModelProvider";
import { useToast } from "../../providers/ToastProvider";

const Home = () => {
  const navig = useNavigate();
  const { activeModel } = useModels();
  const { show } = useToast();

  const action = (data?: any) => {
    if (!activeModel) {
      show("Please select a model", "error");
      return;
    }
    navig("/new-session", { replace: true, state: data });
  };

  return (
    <box
      alignItems="flex-start"
      justifyContent="space-between"
      flexGrow={1}
      gap={1}
      backgroundColor={theme.backgroundColor}
    >
      <Header />
      <box paddingY={2} width={"100%"}>
        <InputBar action={action} />
      </box>
    </box>
  );
};

export default Home;
