#!/bin/zsh

# Define variables
zip="./test.zip"
dumpster_name="test_dumpster"
output_file="test_output.txt"
ddd_commands=("dump" "hoard" "rummage" "upcycle" "burn")
upcycle_formats=("md" "txt" "html")

# Start the dumpster lifecycle test
echo "Beginning dumpster lifecycle test..."
echo "Test started on: " $(date) "\n" > $output_file

echo "=========== TESTING HELP COMMANDS ===========\n" >> $output_file

# Test help commands for each ddd command
for command in "${ddd_commands[@]}"; do
    echo "Testing output of 'ddd help $command'... "

    echo "\n------------------------------------------" >> $output_file
    echo "Testing output of 'ddd help $command'... " >> $output_file
    echo "------------------------------------------\n" >> $output_file
    ddd help $command &>> $output_file
done
echo "Help commands test complete."

# Test creating a new dumpster
echo "Testing creation of new dumpster '$dumpster_name'... "

echo "\n------------------------------------------" >> $output_file
echo "Testing creation of new dumpster '$dumpster_name'... " >> $output_file
echo "------------------------------------------\n" >> $output_file
ddd $ddd_commands[1] -n $dumpster_name $zip &>> $output_file

echo "dump test comlete."

# Test listing all dumpsters
echo "Testing listing dumpster hoard... "

echo "\n------------------------------------------" >> $output_file
echo "Testing listing dumpster hoard... " >> $output_file
echo "------------------------------------------\n" >> $output_file
ddd $ddd_commands[2] &>> $output_file

echo "hoard test comlete."

# Test rummaging through the dumpster
# echo "Testing rummaging through dumpster '$dumpster_name'... "

# echo "\n------------------------------------------" >> $output_file
# echo "Testing rummaging through dumpster '$dumpster_name'... " >> $output_file
# echo "------------------------------------------\n" >> $output_file
# ddd $ddd_commands[3] -l 10 $dumpster_name &>> $output_file

# echo "rummage test comlete."

# Test upcycling the dumpster content
for format in "${upcycle_formats[@]}"; do
    if [[ "$format" == "html" ]]; then
        echo "Testing upcycling of dumpster '$dumpster_name' to $format format with self-contained media... "

        echo "\n--------------------------------------------------------------------" >> $output_file
        echo "Testing upcycling of dumpster '$dumpster_name' to $format format with self-contained media... " >> $output_file
        echo "--------------------------------------------------------------------\n" >> $output_file
        ddd $ddd_commands[4] $format --self-contained $dumpster_name &>> $output_file

        echo "Upcycling of dumpster '$dumpster_name' to $format format with external media complete."
    else
        echo "Testing upcycling of dumpster '$dumpster_name' to $format format... "

        echo "\n--------------------------------------------------------------------" >> $output_file
        echo "Testing upcycling of dumpster '$dumpster_name' to $format format... " >> $output_file
        echo "--------------------------------------------------------------------\n" >> $output_file
        ddd $ddd_commands[4] $format --include-media $dumpster_name &>> $output_file

        echo "Upcycling of dumpster '$dumpster_name' to $format format complete."
    fi
done
echo "Upcycling tests complete."

# Test burning the dumpster
echo "Testing burning of dumpster '$dumpster_name'... "

echo "\n------------------------------------------" >> $output_file
echo "Testing burning of dumpster '$dumpster_name'... " >> $output_file
echo "------------------------------------------\n" >> $output_file
ddd $ddd_commands[5] --dry-run $dumpster_name &>> $output_file
ddd $ddd_commands[5] -f $dumpster_name &>> $output_file

echo "burn test complete."

# Test listing all dumpsters after burning
echo "Testing listing dumpster hoard after burning... "

echo "\n------------------------------------------" >> $output_file
echo "Testing listing dumpster hoard after burning... " >> $output_file
echo "------------------------------------------\n" >> $output_file
ddd $ddd_commands[2] &>> $output_file

echo "hoard test after burning complete."

# Test complete
echo "Test complete. Results saved to $output_file. \n"
echo "================ TEST RESULTS ================\n"
cat $output_file
