let flags = {
  delay: false,
  delayMs: 1200,
  error: false,
  flaky: false
};

exports.get = (_req, res) => res.json(flags);

exports.update = (req, res) => {
  flags = { ...flags, ...req.body };
  res.json(flags);
};

exports.shouldDelay = () => flags.delay || (flags.flaky && Math.random() < 0.3);
exports.delayMs = () => flags.delayMs || 1200;
exports.shouldError = () => flags.error || (flags.flaky && Math.random() < 0.1);
