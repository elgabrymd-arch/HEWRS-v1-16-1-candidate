// Same real baseline engine with the actual browser's empty-store model and request.
const fs=require('fs'),R=process.env.HEWRS_BASELINE,g=require('./core-loader.cjs')(R),c=g.HEWRSCleanConnection.create(g.HEWRS_INPUTS),x=JSON.parse(fs.readFileSync(process.argv[2]));
c.hybrid.setLearningModel(x.model);const r=c.controller.generate(x.request,c.catalogue,[]);fs.writeFileSync(process.argv[3],JSON.stringify(r.options));
