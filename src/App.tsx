import React from "react";
import { DateDisplay } from "./components/Date/Date";
import {
  DateEdit,
  InfoEdit,
  TimeEdit,
} from "./components/EditWidget/EditWidget";
import { Info } from "./components/Info/Info";
import { Time } from "./components/Time/Time";
import { Background } from "./containers/Background/Background";
import { Widget } from "./containers/Widget/Widget";
import { useBackground } from "./hooks/useBackground";
import { useInfoConfig } from "./hooks/useInfoConfig";

const App: React.FC = () => {
  const { currentBackground, filmTitle, loading: bgLoading } = useBackground();
  const {
    titlejp,
    title,
    year,
    screentime,
    quote,
    loading: infoLoading,
  } = useInfoConfig(filmTitle);

  return (
    <Background currentBackground={currentBackground} loading={bgLoading}>
      {!bgLoading && !infoLoading && (
        <Widget storageKey="info" editComponent={<InfoEdit />}>
          <Info
            titlejp={titlejp}
            title={title}
            year={year}
            screentime={screentime}
            quote={quote}
          />
        </Widget>
      )}
      <Widget
        storageKey="date_position"
        editComponent={<DateEdit />}
        initialPosition={{ x: 80, y: 20 }}
      >
        <DateDisplay />
      </Widget>
      <Widget
        storageKey="time_position"
        editComponent={<TimeEdit />}
        initialPosition={{ x: 50, y: 20 }}
      >
        <Time />
      </Widget>
    </Background>
  );
};

export default App;
