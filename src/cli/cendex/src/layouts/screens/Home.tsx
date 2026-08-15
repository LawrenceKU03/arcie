import { useNavigate } from "react-router";
import { theme } from "../../../theme";
import Header from "../../components/Header";
import InputBar from "../../components/InputBar";

const Home = () => {
  const navig = useNavigate();

  const action = (data?: any) => {
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
      <box paddingY={2}>
        <InputBar action={action} />
      </box>
    </box>
  );
};

export default Home;
