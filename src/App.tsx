import { useState, useEffect, useRef } from 'react';
import './App.css';
import { Button, FormControl, InputLabel, MenuItem, Select, Typography, Container, Box, Paper, LinearProgress } from '@mui/material';

type TransitionPhase = 'starting' | 'stopping' | 'restarting';

function App({ iconPath }: { iconPath?: string }) {
  const [colimaRunning, setColimaRunning] = useState<boolean | null>(null);
  const [contexts, setContexts] = useState<any[]>([]);
  const [selectedContext, setSelectedContext] = useState<string>('');
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase | null>(null);
  const [isToggleCoolingDown, setIsToggleCoolingDown] = useState(false);
  const toggleCooldownRef = useRef<number | null>(null);

  useEffect(() => {
    if (!window.electronAPI) {
      console.warn('Electron API not available');
      return undefined;
    }

    const unsubscribeOutput = window.electronAPI.onCommandOutput((line) => {
      console.log('Received event:', line);
    });

    const unsubscribeState = window.electronAPI.onColimaState((running) => {
      setColimaRunning(running);
    });

    const unsubscribeContexts = window.electronAPI.onColimaContexts((fetchedContexts) => {
      setContexts(Array.isArray(fetchedContexts) ? fetchedContexts : []);
    });

    window.electronAPI
      .getColimaState?.()
      .then((state) => {
        if (typeof state === 'boolean') {
          setColimaRunning(state);
        }
      })
      .catch((error) => console.warn('Failed to fetch initial Colima state', error));

    window.electronAPI
      .getColimaContexts?.()
      .then((data) => {
        if (Array.isArray(data)) {
          setContexts(data);
          if (!selectedContext && data.length > 0) {
            setSelectedContext(data[0].name);
          }
        }
      })
      .catch((error) => console.warn('Failed to fetch initial contexts', error));

    return () => {
      unsubscribeOutput();
      unsubscribeState();
      unsubscribeContexts();
    };
  }, [selectedContext]);

  useEffect(() => {
    if (!window.electronAPI) {
      return undefined;
    }
    const pollInterval = window.setInterval(() => {
      window.electronAPI?.getColimaContexts?.().catch((error) =>
        console.warn('Failed to refresh contexts', error),
      );
    }, 3000);
    return () => {
      window.clearInterval(pollInterval);
    };
  }, []);

  useEffect(() => () => {
    if (toggleCooldownRef.current) {
      window.clearTimeout(toggleCooldownRef.current);
    }
  }, []);

  const showError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    alert('Error: ' + message);
  };

  const executeCommand = async (command: string, label?: string) => {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    await window.electronAPI.invokeCommand(command);
  };

  const handleToggleColima = () => {
    if (colimaRunning === null || isToggleCoolingDown) {
      return;
    }
    const command = colimaRunning ? 'stop_colima' : 'start_colima';
    const label = colimaRunning ? 'colima stop' : 'colima start';
    if (toggleCooldownRef.current) {
      window.clearTimeout(toggleCooldownRef.current);
    }
    setIsToggleCoolingDown(true);
    toggleCooldownRef.current = window.setTimeout(() => {
      setIsToggleCoolingDown(false);
      toggleCooldownRef.current = null;
    }, 1000);
    setTransitionPhase(colimaRunning ? 'stopping' : 'starting');
    executeCommand(command, label)
      .then(() => setColimaRunning(!colimaRunning))
      .catch((error) => {
        setTransitionPhase(null);
        showError(error);
      })
      .finally(() => {
        if (command !== 'restart_colima') {
          setTransitionPhase(null);
        }
      });
  };

  const handleRestart = () => {
    if (transitionPhase) {
      return;
    }
    setTransitionPhase('restarting');
    executeCommand('restart_colima', 'colima restart')
      .catch((error) => {
        setTransitionPhase(null);
        showError(error);
      })
      .finally(() => {
        setTransitionPhase(null);
      });
  };

  const formatBytes = (value?: number) => {
    if (!value) {
      return '—';
    }
    const gb = value / (1024 ** 3);
    return `${gb.toFixed(2)} GB`;
  };

  const contextFields = [
    { label: 'Status', key: 'status' },
    { label: 'Architecture', key: 'arch' },
    { label: 'CPUs', key: 'cpus' },
    { label: 'Memory', key: 'memory', format: formatBytes },
    { label: 'Disk', key: 'disk', format: formatBytes },
  ];

  const selectedContextData = contexts.find((ctx) => ctx.name === selectedContext);
  const isTransitioning = transitionPhase !== null;

  return (
    <Container maxWidth="lg">
      <Box display="flex" alignItems="center" gap={2} mb={2}>
        {iconPath && (
          <img src={iconPath} alt="Colima icon" width={40} height={40} />
        )}
        <Typography variant="h4" gutterBottom margin={0}>
          Colima GUI
        </Typography>
      </Box>
      <Box display="flex" justifyContent="space-between" columnGap={4}>
        <Box display="flex" flexDirection="column" gap={2}>
          <Button
            variant="contained"
            disabled={colimaRunning === null || isTransitioning || isToggleCoolingDown}
            onClick={handleToggleColima}
            style={{
              backgroundColor: colimaRunning ? '#c62828' : '#2e7d32',
            }}
          >
            {colimaRunning ? 'Stop Colima' : 'Start Colima'}
          </Button>
          <Button variant="contained" disabled={isTransitioning} onClick={handleRestart}>Restart</Button>
        </Box>
        <Paper
          elevation={3}
          style={{
            padding: '10px',
            backgroundColor: 'white',
            color: 'black',
            height: '400px',
            overflowY: 'auto',
            width: '100%',
          }}
        >
          <Box display="flex" flexDirection="column" gap={2} mb={2}>
            {transitionPhase && (
              <Box>
                <Typography variant="body2" gutterBottom>
                  {transitionPhase === 'starting' && 'Starting Colima...'}
                  {transitionPhase === 'stopping' && 'Stopping Colima...'}
                  {transitionPhase === 'restarting' && 'Restarting Colima...'}
                </Typography>
                <LinearProgress />
              </Box>
            )}
            <FormControl fullWidth>
              <InputLabel id="context-select-label">Colima Profile</InputLabel>
              <Select
                labelId="context-select-label"
                value={selectedContext}
                label="Colima Profile"
                onChange={(event) => setSelectedContext(event.target.value)}
              >
                {contexts.map((ctx) => (
                  <MenuItem key={ctx.name} value={ctx.name}>
                    {ctx.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          {selectedContextData ? (
            <Box display="flex" flexDirection="column" gap={1}>
              {contextFields.map(({ label, key, format }) => (
                <Box key={key} display="flex" justifyContent="space-between">
                  <strong>{label}</strong>
                  <span>{format ? format(selectedContextData[key]) : selectedContextData[key]}</span>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography>Select a context to view details.</Typography>
          )}
        </Paper>
      </Box>
    </Container>
  );
}

export default App;
