module.exports = {
  presets: [
    [
      '@babel/env',
      {
        targets: {
          browsers: ['Chrome 62']
        },
        loose: true,
        modules: process.env.BABEL_ENV === 'cjs' ? 'commonjs' : false,
        exclude: ['transform-typeof-symbol'],
        forceAllTransforms: process.env.NODE_ENV === 'production',
      },
    ],
    '@babel/react',
    '@babel/stage-2',
  ],
  plugins: [
    'annotate-pure-calls',
    ['babel-plugin-transform-redux-saga-source', {
      basePath: process.cwd()
    }]
  ],
}
