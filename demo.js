import Gleap from './index';

const run = async () => {
    Gleap.init('JaVMHmAj6myklFFhTqpNBIudSCv79m4b');

    Gleap.identify("349494", {
        name: "John Doe",
    })
};
run();