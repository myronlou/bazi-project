import React, { useState } from 'react';
import axios from 'axios';
import { 
  Container, TextField, Button, Paper, Typography,
  Grid, Alert, CircularProgress, MenuItem, Select, FormControl, InputLabel, Box
} from '@mui/material';

const TIMEZONES = [
  { value: 'Asia/Hong_Kong', label: '香港時間 (Asia/Hong_Kong)' },
  { value: 'Asia/Taipei', label: '台灣時間 (Asia/Taipei)' },
];

function App() {
  // We add "gender" to the form so user can pick male/female
  const [form, setForm] = useState({ date: '', time: '12:00', gender: 'male', timezone: 'Asia/Hong_Kong', });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function getSolarAge(birthDateStr) {
    if (!birthDateStr) return null;
    const birth = new Date(birthDateStr);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post('http://localhost:5001/api/bazi', {
        birthdate: form.date,
        birthtime: form.time,
        gender: form.gender  // pass gender to the backend
      });
      if (!response.data.success) throw new Error(response.data.message);
      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper: split a pillar string (e.g. "庚辰") => { stem: "庚", branch: "辰" }
  function splitPillar(pillar = '') {
    return {
      stem: pillar.charAt(0) || '',
      branch: pillar.charAt(1) || ''
    };
  }

  // If we have results, parse pillars
  const hourPillar  = result?.pillars?.['時柱'] || '';
  const dayPillar   = result?.pillars?.['日柱'] || '';
  const monthPillar = result?.pillars?.['月柱'] || '';
  const yearPillar  = result?.pillars?.['年柱'] || '';

  const hour = splitPillar(hourPillar);
  const day  = splitPillar(dayPillar);
  const month= splitPillar(monthPillar);
  const year = splitPillar(yearPillar);

  // Ten Gods for Heavenly Stems (old style)
  const hourGod  = result?.shishen?.['時柱'] || '';
  const dayGod   = result?.shishen?.['日柱'] || '';
  const monthGod = result?.shishen?.['月柱'] || '';
  const yearGod  = result?.shishen?.['年柱'] || '';

  // Compute current age if birthdate is provided
  const currentAge = getSolarAge(form.date);
  const currentYear = new Date().getFullYear();

  // Earthly Branch Ten Gods (array of { stem, tenGod })
  const shishenDetail = result?.shishenDetail || {};

  // Five Elements, Missing, Favorable
  const fiveElementCounts = result?.fiveElementCounts || {};
  const missingElements   = result?.missingElements || [];
  const favorableElement  = result?.favorableElement || '';

  // DaYun array
  const daYun = result?.daYun || [];
  // LiuNian array
  const liuNian = result?.liuNian || [];

  // From the arrays, find the current dayun and liuNian based on current age
  const currentDayun = result?.daYun?.find(dy => currentYear >= dy.startCalendarYear && currentYear <= dy.endCalendarYear);
  const currentLiuNian = result?.liuNian?.find((ln) => ln.year === currentYear);

  if (currentDayun) {
    shishenDetail['當前大運'] = {
      stem: currentDayun.tenGod,
      branch: currentDayun.fuXing
    };
  }
  
  if (currentLiuNian) {
    shishenDetail['當前流年'] = {
      stem: currentLiuNian.tenGod,
      branch: currentLiuNian.fuXing
    };
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          八字命盤計算器
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          請輸入公曆出生時間（並選擇性別）
        </Typography>

        {/* Input Form */}
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={3}>
              <TextField
                label="出生日期"
                type="date"
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="出生時間"
                type="time"
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
                value={form.time}
                onChange={e => setForm({ ...form, time: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth>
                <InputLabel id="gender-label">性別</InputLabel>
                <Select
                  labelId="gender-label"
                  label="性別"
                  value={form.gender}
                  onChange={e => setForm({ ...form, gender: e.target.value })}
                >
                  <MenuItem value="male">男</MenuItem>
                  <MenuItem value="female">女</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth>
                <InputLabel id="timezone-label">時區</InputLabel>
                <Select
                  labelId="timezone-label"
                  label="時區"
                  value={form.timezone}
                  onChange={e => setForm({ ...form, timezone: e.target.value })}
                >
                  {TIMEZONES.map((tz) => (
                    <MenuItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Button 
                variant="contained" 
                type="submit" 
                fullWidth
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : '開始計算'}
              </Button>
            </Grid>
          </Grid>
        </form>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {result && (
          <>
            <Typography variant="h5" gutterBottom>
              八字
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              農曆 {result.lunar.lunarYear}年 {result.lunar.lunarMonthName}{' '}
              {result.lunar.lDayName || result.lunar.lunarDay}日
            </Typography>

            {/* Display the 4 Pillars & Ten Gods (Heavenly Stems) */}
            <Grid container spacing={2} sx={{ textAlign: 'center', mb: 4 }}>
              {/* Row 1: Labels */}
              <Grid item xs={2}><Typography variant="subtitle2">時柱</Typography></Grid>
              <Grid item xs={2}><Typography variant="subtitle2">日柱</Typography></Grid>
              <Grid item xs={2}><Typography variant="subtitle2">月柱</Typography></Grid>
              <Grid item xs={2}><Typography variant="subtitle2">年柱</Typography></Grid>
              <Grid item xs={2}><Typography variant="subtitle2">當前大運</Typography></Grid>
              <Grid item xs={2}><Typography variant="subtitle2">當前流年</Typography></Grid>

              {/* Row 2: Ten Gods (Heavenly Stems) */}
              <Grid item xs={2}><Typography variant="subtitle2">{hourGod}</Typography></Grid>
              <Grid item xs={2}><Typography variant="subtitle2">{dayGod}</Typography></Grid>
              <Grid item xs={2}><Typography variant="subtitle2">{monthGod}</Typography></Grid>
              <Grid item xs={2}><Typography variant="subtitle2">{yearGod}</Typography></Grid>
              <Grid item xs={2}><Typography variant="subtitle2">{currentDayun ? currentDayun.tenGod : '-'}</Typography></Grid>
              <Grid item xs={2}><Typography variant="subtitle2">{currentLiuNian ? currentLiuNian.tenGod : '-'}</Typography></Grid>

              {/* Row 3: Stems */}
              <Grid item xs={2}><Typography variant="h4">{hour.stem}</Typography></Grid>
              <Grid item xs={2}><Typography variant="h4">{day.stem}</Typography></Grid>
              <Grid item xs={2}><Typography variant="h4">{month.stem}</Typography></Grid>
              <Grid item xs={2}><Typography variant="h4">{year.stem}</Typography></Grid>
              <Grid item xs={2}><Typography variant="h4">{currentDayun ? currentDayun.pillar.charAt(0) : ''}</Typography></Grid>
              <Grid item xs={2}><Typography variant="h4">{currentLiuNian ? currentLiuNian.pillar.charAt(0) : ''}</Typography></Grid>

              {/* Row 4: Branches */}
              <Grid item xs={2}><Typography variant="h4">{hour.branch}</Typography></Grid>
              <Grid item xs={2}><Typography variant="h4">{day.branch}</Typography></Grid>
              <Grid item xs={2}><Typography variant="h4">{month.branch}</Typography></Grid>
              <Grid item xs={2}><Typography variant="h4">{year.branch}</Typography></Grid>
              <Grid item xs={2}><Typography variant="h4">{currentDayun ? currentDayun.pillar.charAt(1) : ''}</Typography></Grid>
              <Grid item xs={2}><Typography variant="h4">{currentLiuNian ? currentLiuNian.pillar.charAt(1) : ''}</Typography></Grid>
            </Grid>

            {/* 地支藏干十神 (Hidden stems Ten Gods) 
            <Typography variant="h5" gutterBottom>
              地支藏干十神
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              (對每個地支的藏干計算十神)
            </Typography>*/}

            <Grid container spacing={2} sx={{ textAlign: 'center', mb: 4 }}>
              {['時柱','日柱','月柱','年柱','當前大運','當前流年'].map((pillarKey) => {
                const detail = shishenDetail[pillarKey] || {};
                // detail.branch is now an array of { stem: '戊', tenGod: '偏印' } objects
                return (
                  <Grid item xs={12} sm={2} key={pillarKey}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        {pillarKey}
                      </Typography>
                      {detail.branch && detail.branch.length > 0 ? (
                        detail.branch.map((obj, idx) => (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            key={idx}
                          >
                            {obj.stem} ({obj.tenGod})
                          </Typography>
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          無
                        </Typography>
                      )}
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>

            {/* 五行分析 */}
            <Typography variant="h5" gutterBottom>
              五行分析
            </Typography>
            <Typography variant="body1">
              五行數量：
              <br />
              木：{fiveElementCounts['木'] || 0},
              火：{fiveElementCounts['火'] || 0},
              土：{fiveElementCounts['土'] || 0},
              金：{fiveElementCounts['金'] || 0},
              水：{fiveElementCounts['水'] || 0}
            </Typography>

            <Typography variant="body1" sx={{ mt: 1 }}>
              五行缺什麼：
              {missingElements.length > 0
                ? missingElements.join('、')
                : '（無缺）'}
            </Typography>

            <Typography variant="body1" sx={{ mt: 1 }}>
              五行喜用神：{favorableElement || '未知'}
            </Typography>

            {/* 大運 (3-row table with 10 columns) */}
            {result.daYun && result.daYun.length > 0 && (
              <>
                <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
                  大運
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  (每十年一運，顯示十神與柱)
                </Typography>

                {/* 3 rows, 10 columns */}
                <Grid container spacing={1} sx={{ textAlign: 'center', mb: 4 }}>
                  {/* Row 1: startAge */}
                  <Grid item xs={12}>
                    <Grid container>
                      {result.daYun.map((dy) => (
                        <Grid item xs={12} sm={1.2} key={dy.index}>
                          <Typography variant="body2">
                            {dy.startAge}歲 ~ {dy.endAge}歲 ({dy.startCalendarYear} - {dy.endCalendarYear})
                          </Typography>
                        </Grid>
                      ))}
                    </Grid>
                  </Grid>

                  {/* Row 2: TenGod */}
                  <Grid item xs={12}>
                    <Grid container>
                      {result.daYun.map((dy) => (
                        <Grid item xs={12} sm={1.2} key={dy.index}>
                          <Typography variant="body2" color="text.secondary">
                            {dy.tenGod}
                          </Typography>
                        </Grid>
                      ))}
                    </Grid>
                  </Grid>

                  {/* Row 3: Pillar */}
                  <Grid item xs={12}>
                    <Grid container>
                      {result.daYun.map((dy) => (
                        <Grid item xs={12} sm={1.2} key={dy.index}>
                          <Typography variant="body2" color="text.secondary">
                            {dy.pillar}
                          </Typography>
                        </Grid>
                      ))}
                    </Grid>
                  </Grid>

                  {/* Row 4: multiple 副星 */}
                  <Grid item xs={12}>
                    <Grid container>
                      {result.daYun.map((dy) => (
                        <Grid item xs={1.2} key={dy.index}>
                          {dy.fuXing && dy.fuXing.length > 0 ? (
                            dy.fuXing.map((fx, idx) => (
                              <Typography variant="body2" color="text.secondary" key={idx}>
                                {fx.stem} ({fx.tenGod})
                              </Typography>
                            ))
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              無
                            </Typography>
                          )}
                        </Grid>
                      ))}
                    </Grid>
                  </Grid>
                </Grid>
              </>
            )}

            {/* 流年 (1..100 yrs) */}
            {liuNian && liuNian.length > 0 && (
              <>
                <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
                  流年 (1~100 歲)
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  (每年一柱，顯示多個副星)
                </Typography>

                {/* We'll show a scrollable list to avoid a huge page */}
                <Box sx={{ maxHeight: 400, overflowY: 'auto', p: 1, border: '1px solid #ccc', mb: 2 }}>
                  {liuNian.map((ln) => (
                    <Box key={ln.age} sx={{ mb: 1 }}>
                      {/* The main info: age, pillar, and main Ten God */}
                      <Typography variant="subtitle2">
                        {ln.age}歲 ({ln.year}): {ln.pillar} (主星: {ln.tenGod})
                      </Typography>

                      {/* Now we map over ln.fuXing to display multiple hidden stems (副星) */}
                      {ln.fuXing && ln.fuXing.length > 0 && (
                        <Typography variant="body2" color="text.secondary">
                          副星:
                          {ln.fuXing.map((fx, idx) => (
                            <span key={idx}>
                              {' '}
                              {fx.stem}({fx.tenGod})
                            </span>
                          ))}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </>
        )}
      </Paper>
    </Container>
  );
}

export default App;
